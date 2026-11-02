/**
 * 后端 API 地址（浏览器侧使用，需以 NEXT_PUBLIC_ 开头）。
 * 开发环境默认指向本地 NestJS 服务。
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * 带会话的 fetch 封装：
 * 会话是后端下发的 httpOnly cookie，跨端口请求必须显式携带凭据。
 */
export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}
