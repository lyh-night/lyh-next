import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ApiResponse } from '../types/api-response.js'

/**
 * 统一错误响应结构：
 * { status: { code, message }, data: null, stack: string[] }
 *
 * - HTTP 状态固定 200，错误信息通过 status.code 表达；
 * - code 取 HttpException 的状态码，未预期异常统一 500；
 * - stack 为后端调用栈（按行拆分），供前端/开发者排查。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttpException = exception instanceof HttpException
    const code = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const message = this.resolveMessage(exception)
    const stack = this.resolveStack(exception)

    if (!isHttpException) {
      this.logger.error(
        `${request.method} ${request.originalUrl} 未处理异常`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    // SSE 等已经写头的响应无法再写 JSON，只记录日志
    if (response.headersSent) {
      this.logger.error(
        `${request.method} ${request.originalUrl} 响应已开始，无法写入错误体（code=${code}）`,
      )
      return
    }

    const body: ApiResponse<null> = {
      status: { code, message },
      data: null,
      stack,
    }

    response.status(HttpStatus.OK).json(body)
  }

  private resolveMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) return '服务器内部错误'

    const payload = exception.getResponse()
    let message: string | undefined

    if (typeof payload === 'string') {
      message = payload
    } else if (payload && typeof payload === 'object') {
      const raw = (payload as { message?: unknown }).message

      if (Array.isArray(raw)) {
        message = raw.filter((item): item is string => typeof item === 'string').join('；')
      } else if (typeof raw === 'string') {
        message = raw
      }
    }

    return message?.trim() || '请求失败，请稍后重试'
  }

  private resolveStack(exception: unknown): string[] {
    if (!(exception instanceof Error) || !exception.stack) return []

    return exception.stack.split('\n').filter(Boolean)
  }
}
