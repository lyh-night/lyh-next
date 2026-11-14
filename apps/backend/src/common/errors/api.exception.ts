import { HttpException, HttpStatus } from '@nestjs/common'
import type { ApiCodeValue } from './api-code.js'

/**
 * 携带业务码的异常。
 *
 * - `code`：返回给前端的业务码（见 `api-code.ts`），与 HTTP 状态无关；
 * - `httpStatus`：只用于框架层分类与日志，JSON 接口实际写出的 HTTP 恒为 200。
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: ApiCodeValue,
    message: string,
    httpStatus: number = HttpStatus.BAD_REQUEST,
  ) {
    super(message, httpStatus)
  }
}
