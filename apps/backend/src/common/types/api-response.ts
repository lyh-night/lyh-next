/**
 * 后端统一响应结构（扁平信封）：
 * - 成功 `{ code: 0, message: '', data }`
 * - 失败 `{ code, message, data: null, stack? }`
 *
 * JSON 接口在后端可达时 HTTP 恒为 200，业务结果由 `code` 表达。
 */
export interface ApiSuccess<T> {
  code: 0
  message: ''
  data: T | null
}

export interface ApiFailure {
  code: number
  message: string
  data: null
  /** 仅未预期异常（code=10000）且非生产环境返回；前端不展示 */
  stack?: string[]
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure
