'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { listModels } from '../api'
import type { ChatModel } from '../types'
import { useChatHistory } from './use-chat-history'
import { useChatStream } from './use-chat-stream'
import { useConversationList } from './use-conversation-list'

/**
 * 对话页 controller：组合「会话列表 / 消息历史 / 流式发送」三个领域 hook，
 * 并负责当前会话 id、模型选择、URL 状态与初始化。
 * 组件只消费本 hook 的返回值，所有副作用都在这里（及子 hook）发生。
 */
export function useChat() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 当前会话
  const [activeId, setActiveId] = useState<string | null>(null)

  // 模型
  const [models, setModels] = useState<ChatModel[]>([])
  const [modelId, setModelId] = useState('')

  // 流式
  const [streaming, setStreaming] = useState(false)

  const history = useChatHistory()
  const list = useConversationList()

  /** 当前会话写入 ?c=<id>，刷新/深链可恢复 */
  const syncUrl = useCallback(
    (conversationId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (conversationId) {
        params.set('c', conversationId)
      } else {
        params.delete('c')
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const stream = useChatStream({
    activeId,
    setActiveId,
    messages: history.messages,
    setMessages: history.setMessages,
    streaming,
    setStreaming,
    modelId,
    onConversationCreated: syncUrl,
    onTurnFinished: list.refresh,
  })
  const streamStop = stream.stop

  const loadModels = useCallback(async () => {
    try {
      const result = await listModels()
      setModels(result.items)
      setModelId((prev) => {
        if (prev && result.items.some((item) => item.id === prev)) return prev
        const fallback = result.items.find((item) => item.isDefault) ?? result.items[0]
        return fallback?.id ?? ''
      })
    } catch {
      // 静默：输入区会根据空模型列表给出引导
    }
  }, [])

  const selectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === activeId) return
      streamStop()
      setActiveId(conversationId)
      history.reset()
      syncUrl(conversationId)
      void history.loadHistory(conversationId)
    },
    [activeId, history, streamStop, syncUrl],
  )

  const newConversation = useCallback(() => {
    streamStop()
    setActiveId(null)
    history.reset()
    syncUrl(null)
  }, [history, streamStop, syncUrl])

  const removeConversation = useCallback(
    async (conversationId: string) => {
      if (conversationId === activeId) {
        streamStop()
        setActiveId(null)
        history.reset()
        syncUrl(null)
      }
      await list.remove(conversationId)
    },
    [activeId, history, list, streamStop, syncUrl],
  )

  const renameConversation = useCallback(
    (conversationId: string, title: string) => list.rename(conversationId, title),
    [list],
  )

  const loadOlder = useCallback(() => {
    if (!activeId) return
    void history.loadOlder(activeId)
  }, [activeId, history])

  // 初始化：拉列表 + 模型；URL 带 ?c= 时恢复会话
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true

    void list.refresh()
    void loadModels()

    const initial = searchParams.get('c')
    if (initial) {
      setActiveId(initial)
      void history.loadHistory(initial)
    }
  }, [history, list.refresh, loadModels, searchParams])

  return {
    conversations: list.conversations,
    conversationsTotal: list.conversationsTotal,
    loadingConversations: list.loadingConversations,
    activeId,
    messages: history.messages,
    loadingHistory: history.loadingHistory,
    hasMoreHistory: history.hasMoreHistory,
    models,
    modelId,
    setModelId,
    streaming,
    send: stream.send,
    stop: stream.stop,
    retryLastTurn: stream.retryLastTurn,
    selectConversation,
    newConversation,
    removeConversation,
    renameConversation,
    loadOlder,
    loadMoreConversations: list.loadMore,
  }
}

export type ChatController = ReturnType<typeof useChat>
