/**
 * 业务码表（与 HTTP 状态码解耦：HTTP 只用于框架层分类与日志）
 *
 * 规则（详见 docs/err-handing.md §6）：
 * - `0` 成功；非 0 失败；类型为 number；
 * - 按区间分段，只追加、不重排、不复用；废弃的码保留占位；
 * - 区间：`1xxxx` 通用、`2xxxx` 认证、`3xxxx` 对话、`4xxxx` 业务域（预留）、`9xxxx` 系统（预留）；
 * - 预期错误在抛错点显式指定业务码（`ApiException`），通用兜底码只用于未分类异常。
 */
export const ApiCode = {
  /** 成功 */
  OK: 0,

  // 通用（1xxxx）
  /** 未预期异常（兜底） */
  INTERNAL_ERROR: 10000,
  /** 参数 / 校验错误 */
  INVALID_PARAMS: 10001,
  /** 未登录 / 会话失效 */
  UNAUTHORIZED: 10002,
  /** 无权限 */
  FORBIDDEN: 10003,
  /** 资源不存在 */
  NOT_FOUND: 10004,
  /** 冲突 */
  CONFLICT: 10005,
  /** 限流 */
  RATE_LIMITED: 10006,
  /** 请求体过大 */
  PAYLOAD_TOO_LARGE: 10007,

  // 认证（2xxxx）
  /** 邮箱或密码错误 */
  AUTH_INVALID_CREDENTIALS: 20001,
  /** 邮箱已被注册 */
  AUTH_EMAIL_TAKEN: 20002,

  // 对话（3xxxx）
  /** 会话不存在 */
  CHAT_CONVERSATION_NOT_FOUND: 30001,
  /** 模型不存在 / 已下线 */
  CHAT_MODEL_NOT_FOUND: 30002,
  /** 没有可用的模型 */
  CHAT_NO_MODEL: 30003,
  /** content 为空 */
  CHAT_CONTENT_EMPTY: 30004,
  /** 分页锚点无效 */
  CHAT_INVALID_ANCHOR: 30005,
  /** 上游拒绝了请求（上游 400） */
  CHAT_UPSTREAM_REJECTED: 30006,
  /** 上游鉴权失败（上游 401 / 403） */
  CHAT_UPSTREAM_AUTH: 30007,
  /** 上游地址错误（上游 404） */
  CHAT_UPSTREAM_NOT_FOUND: 30008,
  /** 上游限流（上游 429） */
  CHAT_UPSTREAM_RATE_LIMITED: 30009,
  /** 上游服务异常 / 超时 / 网络错误 */
  CHAT_UPSTREAM_ERROR: 30010,
  /** 上游返回非 SSE 响应 */
  CHAT_UPSTREAM_NOT_SSE: 30011,
  /** 流中断（仅 SSE 错误帧，不进信封） */
  CHAT_STREAM_INTERRUPTED: 30012,
} as const

export type ApiCodeValue = (typeof ApiCode)[keyof typeof ApiCode]

/**
 * HTTP 状态 → 兜底业务码。
 * 只用于没有显式 `ApiException` 的异常；未列出的状态统一归入 10000。
 */
export const HTTP_STATUS_FALLBACK: Readonly<Record<number, ApiCodeValue>> = {
  400: ApiCode.INVALID_PARAMS,
  401: ApiCode.UNAUTHORIZED,
  403: ApiCode.FORBIDDEN,
  404: ApiCode.NOT_FOUND,
  409: ApiCode.CONFLICT,
  413: ApiCode.PAYLOAD_TOO_LARGE,
  429: ApiCode.RATE_LIMITED,
}
