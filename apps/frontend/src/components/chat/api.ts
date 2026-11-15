import { request } from '@/utils/api'
import type {
  ChatHistoryResult,
  ChatModel,
  ConversationListResult,
  ConversationSummary,
} from './types'

export function listConversations(page = 1, limit = 20) {
  return request<ConversationListResult>({
    url: `/api/chat/conversations?page=${page}&limit=${limit}`,
    method: 'GET',
  })
}

export function deleteConversation(id: string) {
  return request<{ success: true }>({
    url: `/api/chat/conversations/${id}`,
    method: 'DELETE',
  })
}

export function updateConversation(id: string, data: { title?: string }) {
  return request<ConversationSummary>({
    url: `/api/chat/conversations/${id}`,
    method: 'PATCH',
    data,
  })
}

/** 撤回最后一轮未完成的回合（重试前调用）；success=false 表示最后一轮已完成不可撤回 */
export function deleteLastTurn(id: string) {
  return request<{ success: boolean }>({
    url: `/api/chat/conversations/${id}/last-turn`,
    method: 'DELETE',
  })
}

export function getHistory(
  conversationId: string,
  options?: { messageId?: string; limit?: number },
) {
  const params = new URLSearchParams({ conversationId })
  if (options?.messageId) params.set('messageId', options.messageId)
  params.set('limit', String(options?.limit ?? 50))

  return request<ChatHistoryResult>({
    url: `/api/chat/history?${params.toString()}`,
    method: 'GET',
  })
}

export function listModels() {
  return request<{ items: ChatModel[] }>({
    url: '/api/chat/models',
    method: 'GET',
  })
}
