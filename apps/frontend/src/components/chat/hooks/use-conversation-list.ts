'use client'

import { useCallback, useRef, useState } from 'react'
import { deleteConversation, listConversations, updateConversation } from '../api'
import type { ConversationSummary } from '../types'

/** 会话列表分页大小 */
const CONVERSATION_PAGE_SIZE = 20

/**
 * 会话列表数据（业务逻辑）：刷新、加载更多、重命名、删除。
 * 只负责接口调用与列表状态，不关心当前选中会话（由 useChat 编排）。
 */
export function useConversationList() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationsTotal, setConversationsTotal] = useState(0)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const pageRef = useRef(1)

  const refresh = useCallback(async () => {
    try {
      const result = await listConversations(pageRef.current, CONVERSATION_PAGE_SIZE)
      setConversations(result.items)
      setConversationsTotal(result.total)
    } catch {
      // toast 已由统一通道弹出，列表保留旧数据
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (conversations.length >= conversationsTotal) return
    const next = pageRef.current + 1
    try {
      const result = await listConversations(next, CONVERSATION_PAGE_SIZE)
      pageRef.current = next
      setConversations((prev) => {
        const known = new Set(prev.map((item) => item.id))
        return [...prev, ...result.items.filter((item) => !known.has(item.id))]
      })
      setConversationsTotal(result.total)
    } catch {
      // toast 已弹
    }
  }, [conversations.length, conversationsTotal])

  const rename = useCallback(async (conversationId: string, title: string) => {
    try {
      const updated = await updateConversation(conversationId, { title })
      setConversations((prev) => prev.map((item) => (item.id === conversationId ? updated : item)))
    } catch {
      // toast 已弹
    }
  }, [])

  /** 删除会话：接口成功后从本地列表移除（当前选中会话的清理由 useChat 负责） */
  const remove = useCallback(async (conversationId: string) => {
    try {
      await deleteConversation(conversationId)
      setConversations((prev) => prev.filter((item) => item.id !== conversationId))
      setConversationsTotal((prev) => Math.max(0, prev - 1))
    } catch {
      // toast 已弹
    }
  }, [])

  return {
    conversations,
    conversationsTotal,
    loadingConversations,
    refresh,
    loadMore,
    rename,
    remove,
  }
}
