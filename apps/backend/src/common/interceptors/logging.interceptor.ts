import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { tap } from 'rxjs'

/** 记录每个请求的方法、路径、状态码与耗时 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const startedAt = Date.now()

    const log = (status: number) => {
      this.logger.log(
        `${request.method} ${request.originalUrl} ${status} ${Date.now() - startedAt}ms`,
      )
    }

    return next.handle().pipe(
      tap({
        next: () => log(response.statusCode),
        error: (error: { status?: number }) => log(error.status ?? 500),
      }),
    )
  }
}
