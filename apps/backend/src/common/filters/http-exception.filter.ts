import { ArgumentsHost, Catch, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { ApiCode } from '../errors/api-code.js'
import { resolveApiCode, resolveApiMessage, shouldIncludeStack } from '../errors/api-error.js'
import type { ApiFailure } from '../types/api-response.js'

/**
 * 全局异常过滤器（无差别捕获整条链路的异常）。
 *
 * 输出：`{ code, message, data: null, stack? }`，HTTP 恒为 200。
 * - `code` 为业务码（见 api-code.ts），不是 HTTP 状态码；
 * - `message` 为可直接展示的中文文案；
 * - `stack` 仅未预期异常（code=10000）且非生产环境返回；
 * - 响应已开始/已结束（SSE 等）时只记日志，不再写 JSON。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)
  private readonly isProduction: boolean

  constructor(config: ConfigService) {
    this.isProduction = config.getOrThrow<string>('NODE_ENV') === 'production'
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const code = resolveApiCode(exception)
    const message = resolveApiMessage(exception, code)
    const stack = shouldIncludeStack(code, this.isProduction) ? splitStack(exception) : undefined

    // 未预期异常：完整堆栈只进服务端日志，不返回给客户端（除非非生产环境由 stack 字段带回）
    if (code === ApiCode.INTERNAL_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} code=${code} 未预期异常`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    // SSE 已写头，或响应已结束/连接已销毁：无法再写 JSON
    if (response.headersSent || response.writableEnded || response.destroyed) {
      this.logger.error(
        `${request.method} ${request.originalUrl} code=${code} 响应已开始或已结束，无法写入错误体`,
      )
      return
    }

    const body: ApiFailure = { code, message, data: null, ...(stack ? { stack } : {}) }

    response.status(HttpStatus.OK).json(body)
  }
}

function splitStack(exception: unknown): string[] {
  if (!(exception instanceof Error) || !exception.stack) return []

  return exception.stack.split('\n').filter(Boolean)
}
