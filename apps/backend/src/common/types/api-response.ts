/** 统一业务状态：code = 0 表示成功，非 0 表示失败 */
export interface ApiResponseStatus {
  code: number
  message: string
}

/** 后端统一响应结构：{ status, data, stack } */
export interface ApiResponse<T> {
  status: ApiResponseStatus
  data: T | null
  /** 失败时为后端调用栈（按行拆分），成功为空数组 */
  stack: string[]
}
