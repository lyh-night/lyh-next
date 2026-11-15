import { Injectable, type LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import pino, { type Logger as PinoInstance } from 'pino'

/**
 * pino 结构化日志（Nest LoggerService 实现，经 app.useLogger 接管全部 Nest 日志）。
 * - 生产环境输出单行 JSON（可被采集器直接解析）；
 * - 开发环境经 pino-pretty 着色（仅 devDependencies，生产分支不会加载）；
 * - 业务代码照常用 `new Logger(...)`，或直接注入本服务写结构化字段。
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly pino: PinoInstance

  constructor(config: ConfigService) {
    this.pino = PinoLoggerService.createPino(config)
  }

  private static createPino(config: ConfigService): PinoInstance {
    const isProduction = config.getOrThrow<string>('NODE_ENV') === 'production'
    const level = config.getOrThrow<string>('LOG_LEVEL')

    return pino({
      level,
      // 生产走 JSON；开发用 pino-pretty 提升可读性（transport 在运行期才解析目标，生产分支不会触碰该依赖）
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
            },
          }),
    })
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, undefined, context)
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, undefined, context)
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, stack, context)
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, undefined, context)
  }

  verbose(message: unknown, context?: string): void {
    this.write('trace', message, undefined, context)
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, undefined, context)
  }

  /** 结构化字段（对象消息）或纯文本（字符串消息）统一落盘 */
  private write(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: unknown,
    stack?: string,
    context?: string,
  ): void {
    const fields =
      typeof message === 'object' && message !== null ? (message as Record<string, unknown>) : {}
    const msg = typeof message === 'string' ? message : undefined

    this.pino[level](
      {
        ...(context ? { context } : {}),
        ...(stack ? { stack } : {}),
        ...fields,
      },
      msg,
    )
  }
}
