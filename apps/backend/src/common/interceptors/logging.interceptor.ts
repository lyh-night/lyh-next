import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { tap } from 'rxjs'
import { ApiCode } from '../errors/api-code.js'
import { resolveApiCode } from '../errors/api-error.js'
import { PinoLoggerService } from '../logging/pino-logger.service.js'
import { getRequestId } from '../request-context/request-context.js'

/**
 * 记录每个请求的结构化访问日志：method / path / httpStatus / code / durationMs / requestId / userId。
 * 业务失败的响应 HTTP 也是 200，因此日志必须带 `code`，监控也按 `code` 聚合。
 * 超过 SLOW_REQUEST_MS（默认 1s）的请求升为 warn 级别。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly slowRequestMs: number

  constructor(
    private readonly logger: PinoLoggerService,
    config: ConfigService,
  ) {
    this.slowRequestMs = config.getOrThrow<number>('SLOW_REQUEST_MS')
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const startedAt = Date.now()

    const log = (code: number) => {
      // SSE 写头后 response.statusCode 即实际写出值；未写头时按契约记为 200
      const httpStatus = response.headersSent ? response.statusCode : HttpStatus.OK

      const user = (request as Request & { user?: { id?: string } }).user?.id ?? '-'
      const fields = {
        method: request.method,
        path: request.originalUrl,
        httpStatus,
        code,
        durationMs: Date.now() - startedAt,
        requestId: getRequestId() ?? '-',
        userId: user,
      }

      if (fields.durationMs >= this.slowRequestMs) {
        this.logger.warn({ ...fields, slow: true }, 'HTTP')
      } else {
        this.logger.log(fields, 'HTTP')
      }
    }

    return next.handle().pipe(
      tap({
        next: () => log(ApiCode.OK),
        error: (error: unknown) => log(resolveApiCode(error)),
      }),
    )
  }
}
