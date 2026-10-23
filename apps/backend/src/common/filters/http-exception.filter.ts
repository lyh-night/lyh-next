import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'

interface ErrorBody {
  statusCode: number
  message: string | string[]
  error: string
  path: string
  timestamp: string
}

/**
 * 统一错误响应结构：
 * { statusCode, message, error, path, timestamp }
 * 非 HttpException（未预期异常）一律按 500 处理，并记录堆栈。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttpException = exception instanceof HttpException
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    let message: string | string[] = 'Internal server error'
    let error = 'Internal Server Error'

    if (isHttpException) {
      const payload = exception.getResponse()
      if (typeof payload === 'string') {
        message = payload
      } else if (payload && typeof payload === 'object') {
        const body = payload as { message?: string | string[]; error?: string }
        message = body.message ?? exception.message
        error = body.error ?? exception.name
      }
    } else {
      this.logger.error(
        `${request.method} ${request.originalUrl} 未处理异常`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const body: ErrorBody = {
      statusCode,
      message,
      error,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    }

    response.status(statusCode).json(body)
  }
}
