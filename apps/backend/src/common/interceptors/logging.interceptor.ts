import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { tap } from 'rxjs'
import { ApiCode } from '../errors/api-code.js'
import { resolveApiCode } from '../errors/api-error.js'

/**
 * 记录每个请求的方法、路径、实际 HTTP 状态、业务码与耗时：
 * `POST /api/auth/login http=200 code=20001 12ms`
 *
 * 业务失败的响应 HTTP 也是 200，因此日志必须带 `code`，监控也按 `code` 聚合。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const startedAt = Date.now()

    const log = (code: number) => {
      // SSE 写头后 response.statusCode 即实际写出值；未写头时按契约记为 200
      const httpStatus = response.headersSent ? response.statusCode : HttpStatus.OK

      this.logger.log(
        `${request.method} ${request.originalUrl} http=${httpStatus} code=${code} ${Date.now() - startedAt}ms`,
      )
    }

    return next.handle().pipe(
      tap({
        next: () => log(ApiCode.OK),
        error: (error: unknown) => log(resolveApiCode(error)),
      }),
    )
  }
}
