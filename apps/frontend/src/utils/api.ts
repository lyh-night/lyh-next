/**
 * 后端 API 地址（浏览器侧使用，需以 NEXT_PUBLIC_ 开头）。
 * 开发环境默认指向本地 NestJS 服务。
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
