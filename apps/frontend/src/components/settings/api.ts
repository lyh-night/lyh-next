import { request } from '@/utils/api'
import type { ModelConfig, ModelPayload } from './types'

export function listModelConfigs() {
  // 列表页需要内联错误 + 重试，关闭统一 toast
  return request<{ items: ModelConfig[] }>({
    url: '/api/chat/models/configs',
    method: 'GET',
    silent: true,
  })
}

export function createModel(data: ModelPayload) {
  return request<ModelConfig>({
    url: '/api/chat/models',
    method: 'POST',
    data,
  })
}

export function updateModel(id: string, data: Partial<ModelPayload>) {
  return request<ModelConfig>({
    url: `/api/chat/models/${id}`,
    method: 'PATCH',
    data,
  })
}

export function deleteModel(id: string) {
  return request<{ success: true }>({
    url: `/api/chat/models/${id}`,
    method: 'DELETE',
  })
}
