'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { API_CODE, ApiError } from '@/utils/api'
import {
  deleteConversation,
  deleteLastTurn,
  getHistory,
  listConversations,
  listModels,
  updateConversation,
} from './api'
import { postChatCompletion } from './stream'
import type { ChatModel, ConversationSummary, ServerMessage, UiMessage } from './types'

const CONVERSATION_PAGE_SIZE = 20
const HISTORY_PAGE_SIZE = 50
/** delta 合并刷新间隔：流式时 markdown 全量重解析，避免每帧一次 */
const DELTA_FLUSH_MS = 60

function toLocalId(prefix: string) {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  return `${prefix}:${uuid}`
}

function toUiMessage(message: ServerMessage): UiMessage {
  return { ...message, localId: message.id }
}

/**
 * 对话页状态机：会话列表 / 消息 / 流式发送 / 历史分页 / URL 状态。
 * 所有副作用集中在这里，组件只做展示。
 */
export function useChat() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 会话列表
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationsTotal, setConversationsTotal] = useState(0)
  const [loadingConversations, setLoadingConversations] = useState(true)

  // 当前会话与消息
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)

  // 模型
  const [models, setModels] = useState<ChatModel[]>([])
  const [modelId, setModelId] = useState('')

  // 流式
  const [streaming, setStreaming] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const historySeqRef = useRef(0)
  const conversationPageRef = useRef(1)
  const didInitRef = useRef(false)

  // delta 节流：累积到缓冲区，定时合并刷一次 setState
  const deltaRef = useRef<{ localId: string; text: string } | null>(null)
  const flushTimerRef = useRef<number | null>(null)

  const flushDelta = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    const pending = deltaRef.current
    if (!pending) return
    deltaRef.current = null

    setMessages((prev) =>
      prev.map((message) =>
        message.localId === pending.localId
          ? { ...message, content: message.content + pending.text }
          : message,
      ),
    )
  }, [])

  const queueDelta = useCallback(
    (localId: string, text: string) => {
      const pending = deltaRef.current
      if (pending && pending.localId === localId) {
        pending.text += text
      } else {
        flushDelta()
        deltaRef.current = { localId, text }
      }
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flushDelta, DELTA_FLUSH_MS)
      }
    },
    [flushDelta],
  )

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

  const refreshConversations = useCallback(async () => {
    try {
      const result = await listConversations(conversationPageRef.current, CONVERSATION_PAGE_SIZE)
      setConversations(result.items)
      setConversationsTotal(result.total)
    } catch {
      // toast 已由统一通道弹出，列表保留旧数据
    } finally {
      setLoadingConversations(false)
    }
  }, [])

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

  const loadHistory = useCallback(async (conversationId: string) => {
    const seq = ++historySeqRef.current
    setLoadingHistory(true)
    try {
      const result = await getHistory(conversationId, { limit: HISTORY_PAGE_SIZE })
      if (seq !== historySeqRef.current) return
      setMessages(result.items.map(toUiMessage))
      setHasMoreHistory(result.hasMore)
    } catch {
      if (seq === historySeqRef.current) {
        setMessages([])
        setHasMoreHistory(false)
      }
    } finally {
      if (seq === historySeqRef.current) setLoadingHistory(false)
    }
  }, [])

  const loadOlder = useCallback(async () => {
    if (!activeId || !hasMoreHistory || loadingHistory) return
    const anchor = messages[0]
    if (!anchor?.id) return

    const seq = ++historySeqRef.current
    setLoadingHistory(true)
    try {
      const result = await getHistory(activeId, { messageId: anchor.id, limit: HISTORY_PAGE_SIZE })
      if (seq !== historySeqRef.current) return
      setMessages((prev) => [...result.items.map(toUiMessage), ...prev])
      setHasMoreHistory(result.hasMore)
    } catch {
      // toast 已弹，保持现状
    } finally {
      if (seq === historySeqRef.current) setLoadingHistory(false)
    }
  }, [activeId, hasMoreHistory, loadingHistory, messages])

  const loadMoreConversations = useCallback(async () => {
    if (conversations.length >= conversationsTotal) return
    const next = conversationPageRef.current + 1
    try {
      const result = await listConversations(next, CONVERSATION_PAGE_SIZE)
      conversationPageRef.current = next
      setConversations((prev) => {
        const known = new Set(prev.map((item) => item.id))
        return [...prev, ...result.items.filter((item) => !known.has(item.id))]
      })
      setConversationsTotal(result.total)
    } catch {
      // toast 已弹
    }
  }, [conversations.length, conversationsTotal])

  const selectConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === activeId) return
      abortRef.current?.abort()
      setActiveId(conversationId)
      setMessages([])
      syncUrl(conversationId)
      void loadHistory(conversationId)
    },
    [activeId, loadHistory, syncUrl],
  )

  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    syncUrl(null)
  }, [syncUrl])

  const removeConversation = useCallback(
    async (conversationId: string) => {
      try {
        if (conversationId === activeId) {
          abortRef.current?.abort()
          setActiveId(null)
          setMessages([])
          syncUrl(null)
        }
        await deleteConversation(conversationId)
        setConversations((prev) => prev.filter((item) => item.id !== conversationId))
        setConversationsTotal((prev) => Math.max(0, prev - 1))
      } catch {
        // toast 已弹
      }
    },
    [activeId, syncUrl],
  )

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    try {
      const updated = await updateConversation(conversationId, { title })
      setConversations((prev) => prev.map((item) => (item.id === conversationId ? updated : item)))
    } catch {
      // toast 已弹
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim()
      if (!content || streaming) return

      flushDelta()

      const userMessage: UiMessage = {
        localId: toLocalId('user'),
        role: 'user',
        content,
        status: 'completed',
        createdAt: new Date().toISOString(),
      }
      const assistantLocalId = toLocalId('assistant')
      const assistantMessage: UiMessage = {
        localId: assistantLocalId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await postChatCompletion(
          {
            content,
            conversationId: activeId ?? undefined,
            modelId: modelId || undefined,
            signal: controller.signal,
          },
          {
            onConversationId: (conversationId) => {
              setActiveId((prev) => prev ?? conversationId)
              syncUrl(conversationId)
            },
            onMessageId: (messageId) => {
              setMessages((prev) =>
                prev.map((message) =>
                  message.localId === assistantLocalId ? { ...message, id: messageId } : message,
                ),
              )
            },
            onDelta: (text) => queueDelta(assistantLocalId, text),
            onStreamError: (message) => {
              flushDelta()
              setMessages((prev) =>
                prev.map((item) =>
                  item.localId === assistantLocalId
                    ? { ...item, status: 'error', errorMessage: message }
                    : item,
                ),
              )
            },
            onDone: () => {},
          },
        )

        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((item) =>
              item.localId === assistantLocalId && item.status === 'streaming'
                ? { ...item, status: 'aborted' }
                : item,
            ),
          )
        } else {
          setMessages((prev) =>
            prev.map((item) =>
              item.localId === assistantLocalId && item.status === 'streaming'
                ? { ...item, status: 'completed' }
                : item,
            ),
          )
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((item) =>
              item.localId === assistantLocalId && item.status === 'streaming'
                ? { ...item, status: 'aborted' }
                : item,
            ),
          )
        } else if (err instanceof ApiError) {
          // 失败与模型输出显示在同一位置（消息流内的 assistant 错误气泡，参考 DSH）
          setMessages((prev) =>
            prev.map((item) =>
              item.localId === assistantLocalId && item.status === 'streaming'
                ? { ...item, status: 'error', errorMessage: err.message, errorCode: err.code }
                : item,
            ),
          )
        } else {
          setMessages((prev) =>
            prev.map((item) =>
              item.localId === assistantLocalId && item.status === 'streaming'
                ? { ...item, status: 'error', errorMessage: '发送失败，请重试', errorCode: -1 }
                : item,
            ),
          )
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        // 刷新标题 / 时间 / 消息数（新会话也会出现在列表里）
        void refreshConversations()
      }
    },
    [activeId, flushDelta, modelId, queueDelta, refreshConversations, streaming, syncUrl],
  )

  /**
   * 重试最后一轮未完成的回合：撤回末尾的 user（及失败/中断 assistant 占位）后，
   * 用原内容重新发送。仅当最后一条消息处于 error / aborted / 仅有 user 时可用。
   */
  const retryLastTurn = useCallback(async () => {
    if (streaming || !activeId) return

    const last = messages[messages.length - 1]
    if (!last) return

    let userIndex = -1
    if (last.role === 'assistant' && (last.status === 'error' || last.status === 'aborted')) {
      userIndex = messages.length - 2
    } else if (last.role === 'user') {
      userIndex = messages.length - 1
    } else {
      return
    }

    const userMessage = messages[userIndex]
    if (!userMessage || userMessage.role !== 'user') return

    try {
      const result = await deleteLastTurn(activeId)
      if (!result.success) return
    } catch {
      return // toast 已弹
    }

    // 本地移除该轮（assistant 占位 + user），再以原内容重发
    setMessages((prev) => prev.slice(0, userIndex))
    await send(userMessage.content)
  }, [activeId, messages, send, streaming])

  // 初始化：拉列表 + 模型；URL 带 ?c= 时恢复会话
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true

    void refreshConversations()
    void loadModels()

    const initial = searchParams.get('c')
    if (initial) {
      setActiveId(initial)
      void loadHistory(initial)
    }
  }, [loadHistory, loadModels, refreshConversations, searchParams])

  return {
    conversations,
    conversationsTotal,
    loadingConversations,
    activeId,
    messages,
    loadingHistory,
    hasMoreHistory,
    models,
    modelId,
    setModelId,
    streaming,
    send,
    stop,
    retryLastTurn,
    selectConversation,
    newConversation,
    removeConversation,
    renameConversation,
    loadOlder,
    loadMoreConversations,
  }
}

export type ChatController = ReturnType<typeof useChat>
