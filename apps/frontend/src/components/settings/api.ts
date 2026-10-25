import { apiUrl } from '@/utils/api'
import type { ModelConfig, ModelPayload } from './types'

interface ErrorBody {
  message?: string | string[]
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  const data = (await response.json().catch(() => null)) as (T & ErrorBody) | null

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new Error(message || data?.error || '请求失败，请稍后重试')
  }

  return data as T
}

export function listModelConfigs() {
  return request<{ items: ModelConfig[] }>('/api/chat/models/configs')
}

export function createModel(payload: ModelPayload) {
  return request<ModelConfig>('/api/chat/models', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateModel(id: string, payload: Partial<ModelPayload>) {
  return request<ModelConfig>(`/api/chat/models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteModel(id: string) {
  return request<{ success: true }>(`/api/chat/models/${id}`, { method: 'DELETE' })
}
