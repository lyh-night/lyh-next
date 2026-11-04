import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { map, type Observable } from 'rxjs'
import { SKIP_RESPONSE_ENVELOPE } from '../decorators/skip-response-envelope.decorator.js'
import type { ApiResponse } from '../types/api-response.js'

/**
 * 成功响应统一包装：
 * { status: { code: 0, message: '' }, data, stack: [] }
 *
 * 业务失败由 HttpExceptionFilter 处理，HTTP 状态同样固定为 200。
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const http = context.switchToHttp()
    const response = http.getResponse<Response>()
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ])

    if (skip) return next.handle()

    return next.handle().pipe(
      map((data) => {
        // SSE / 已开始写响应：不再包信封
        if (response.headersSent) return data

        return {
          status: { code: 0, message: '' },
          data: data ?? null,
          stack: [],
        }
      }),
    )
  }
}
