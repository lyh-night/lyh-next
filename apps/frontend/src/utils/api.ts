import axios, { type AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'

/**
 * 浏览器侧请求入口（JSON）。
 *
 * - 统一走 axios 实例，组件内不直接调用 fetch / axios。
 * - 后端响应结构：{ code, message, data, stack? }（扁平信封），code = 0 表示成功；
 *   业务失败也是 HTTP 200，失败原因看 code（业务码见 docs/err-handing.md）。
 * - 业务错误与网络错误在这里归一化为 ApiError，并默认弹一次 toast。
 * - 会话失效（code=10002）通过 onUnauthorized 通知 SessionProvider 跳转登录页。
 * - SSE / 流式接口不在本文件处理，后续用 fetch-event-source 单独实现。
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * 后端业务码（与 apps/backend/src/common/errors/api-code.ts 一致）。
 * 前端只声明实际用到的部分。
 */
export const API_CODE = {
  /** 成功 */
  OK: 0,
  /** 未登录 / 会话失效：前端统一回登录页 */
  UNAUTHORIZED: 10002,
} as const

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
  /** 仅未预期异常（code=10000）且非生产环境返回；前端不展示 */
  stack?: string[]
}

export interface RequestConfig extends AxiosRequestConfig {
  /** 不自动弹错误 toast */
  silent?: boolean
  /** 401 不触发全局跳登录（登录/注册/登出/me 使用） */
  skipAuthRedirect?: boolean
}

/**
 * 统一错误类型。
 * code 为后端业务码；网络/超时/主动取消时为 -1。
 */
export class ApiError extends Error {
  readonly code: number
  readonly serverStack: string[]

  constructor(code: number, message: string, serverStack: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.serverStack = serverStack
  }
}

type UnauthorizedListener = () => void

const unauthorizedListeners = new Set<UnauthorizedListener>()
let unauthorizedNotified = false

/**
 * 订阅全局会话失效（code=10002）。
 * 由 SessionProvider 注册，用于清理用户状态并跳转登录页。
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)

  return () => {
    unauthorizedListeners.delete(listener)
  }
}

function notifyUnauthorized() {
  // 并发请求可能同时失效，只通知一次；任意成功响应会重置，重新登录后可再次触发
  if (unauthorizedNotified) return
  unauthorizedNotified = true

  for (const listener of unauthorizedListeners) {
    try {
      listener()
    } catch {
      // 单个订阅者异常不影响其它订阅者与原始错误抛出
    }
  }
}

function notifyError(message: string) {
  if (typeof window === 'undefined') return

  // 同一文案复用同一个 toast，避免并发失败刷屏
  toast.error(message, { id: `api-error:${message}` })
}

function fallbackMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return '请求参数有误，请检查后重试'
    case 401:
      return '未登录或登录已过期'
    case 403:
      return '没有权限执行该操作'
    case 404:
      return '请求的资源不存在'
    case 409:
      return '数据冲突，请刷新后重试'
    case 429:
      return '操作过于频繁，请稍后重试'
    default:
      return status >= 500 ? '服务异常，请稍后重试' : '请求失败，请稍后重试'
  }
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false

  const { code, message } = value as { code?: unknown; message?: unknown }

  return typeof code === 'number' && typeof message === 'string' && 'data' in value
}

function createApiError(input: {
  code: number
  message: string
  stack?: string[]
  config?: RequestConfig
}): ApiError {
  const { code, message, stack = [], config } = input

  if (code === API_CODE.UNAUTHORIZED && !config?.skipAuthRedirect) {
    // 会话失效统一跳登录，不再重复弹错
    notifyUnauthorized()
  } else if (!config?.silent) {
    notifyError(message)
  }

  return new ApiError(code, message, stack)
}

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
})

client.interceptors.response.use(
  (response) => {
    const body: unknown = response.data
    const config = response.config as RequestConfig

    if (!isApiEnvelope(body)) {
      throw createApiError({
        code: -1,
        message: '响应格式异常，请稍后重试',
        config,
      })
    }

    if (body.code !== API_CODE.OK) {
      throw createApiError({
        code: body.code,
        message: body.message || '请求失败，请稍后重试',
        stack: body.stack ?? [],
        config,
      })
    }

    unauthorizedNotified = false
    return response
  },
  (error: unknown) => {
    if (axios.isCancel(error)) {
      return Promise.reject(new ApiError(-1, '请求已取消'))
    }

    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const config = error.config as RequestConfig | undefined
    const response = error.response

    // 非 200：代理/网关/未接管的错误；若仍是统一结构则复用其 code/message
    if (response) {
      const body: unknown = response.data
      const envelope = isApiEnvelope(body) ? body : undefined

      return Promise.reject(
        createApiError({
          // 代理/网关可能返回非信封，此时按 HTTP 状态兜底
          code: envelope?.code ?? response.status,
          message: envelope?.message || fallbackMessageForStatus(response.status),
          stack: envelope?.stack ?? [],
          config,
        }),
      )
    }

    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'

    return Promise.reject(
      createApiError({
        code: -1,
        message: timedOut ? '请求超时，请稍后重试' : '网络连接失败，请检查网络后重试',
        config,
      }),
    )
  },
)

/**
 * 发起 JSON 请求，直接返回业务数据（已解包 data）。
 * 错误已统一提示；调用方 catch 只用于复位状态或内联展示。
 */
export async function request<T>(config: RequestConfig): Promise<T> {
  const response = await client.request<ApiEnvelope<T>>(config)

  return response.data.data as T
}
