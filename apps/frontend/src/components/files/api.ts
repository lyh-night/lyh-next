import { ApiError, apiUrl, isApiEnvelope, reportApiError, request } from '@/utils/api'
import type { TextPage, TreeResponse, WorkspaceMeta } from './types'

/** 文件工作区接口封装：JSON 走全局 `request`，二进制只在这里用 fetch（信封不适用） */

export function createWorkspace(name?: string) {
  return request<WorkspaceMeta>({
    url: '/api/files/workspaces',
    method: 'POST',
    data: { name },
  })
}

export function fetchWorkspace(id: string) {
  return request<WorkspaceMeta>({
    url: `/api/files/workspaces/${encodeURIComponent(id)}`,
    method: 'GET',
  })
}

export function removeWorkspace(id: string) {
  return request<null>({
    url: `/api/files/workspaces/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}

export function removeEntry(workspaceId: string, path: string) {
  return request<{ path: string; type: 'file' | 'directory' }>({
    url: `/api/files/workspaces/${encodeURIComponent(workspaceId)}/entry`,
    method: 'DELETE',
    params: { path },
  })
}

export function fetchTree(id: string) {
  return request<TreeResponse>({
    url: `/api/files/workspaces/${encodeURIComponent(id)}/tree`,
    method: 'GET',
  })
}

export function fetchTextPage(id: string, path: string, offset: number, limit: number) {
  return request<TextPage>({
    url: `/api/files/workspaces/${encodeURIComponent(id)}/read`,
    method: 'GET',
    params: { path, offset, limit },
  })
}

/** 解析非信封的原始响应（上传接口与二进制接口都可能返回业务失败 JSON） */
async function parseFailure(response: Response): Promise<never> {
  const fallback = `请求失败（HTTP ${response.status}）`
  try {
    const body: unknown = await response.json()
    if (isApiEnvelope(body)) {
      throw reportApiError({ code: body.code, message: body.message, stack: body.stack })
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
  }
  throw new ApiError(-1, fallback)
}

/**
 * 上传单个文件（multipart：file + path）。
 * 失败时静默归一化为 ApiError，由调用方汇总成一条提示，避免逐文件弹 toast。
 */
export async function uploadFile(
  workspaceId: string,
  path: string,
  file: File,
  signal: AbortSignal,
): Promise<void> {
  const form = new FormData()
  form.set('file', file)
  form.set('path', path)

  const response = await fetch(
    apiUrl(`/api/files/workspaces/${encodeURIComponent(workspaceId)}/upload`),
    { method: 'POST', body: form, credentials: 'include', signal },
  )

  if (response.status !== 200) await parseFailure(response)

  const body: unknown = await response.json().catch(() => null)
  if (!isApiEnvelope(body)) throw new ApiError(-1, '上传响应格式异常')

  if (body.code !== 0) {
    throw reportApiError({
      code: body.code,
      message: body.message,
      stack: body.stack,
      config: { silent: true },
    })
  }
}

/** 读取原始字节（图片 / PDF 预览使用 Blob URL） */
export async function fetchFileBlob(
  workspaceId: string,
  path: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await fetch(
    apiUrl(
      `/api/files/workspaces/${encodeURIComponent(workspaceId)}/bytes?path=${encodeURIComponent(path)}`,
    ),
    { credentials: 'include', signal },
  )

  const contentType = response.headers.get('content-type') ?? ''
  // 成功是文件 MIME；失败统一走 JSON 信封（HTTP 200）
  if (!response.ok || contentType.includes('application/json')) await parseFailure(response)

  return response.blob()
}
