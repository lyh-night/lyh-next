'use client'

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { ApiError } from '@/utils/api'
import { patchMessage, patchStreamingMessage } from '@/utils/chat-message'
import { deleteLastTurn } from '../api'
import { postChatCompletion } from '../stream'
import type { UiMessage } from '../types'
import { useChatDelta } from './use-chat-delta'

function toLocalId(prefix: string) {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  return `${prefix}:${uuid}`
}

interface UseChatStreamOptions {
  activeId: string | null
  setActiveId: Dispatch<SetStateAction<string | null>>
  messages: UiMessage[]
  setMessages: Dispatch<SetStateAction<UiMessage[]>>
  streaming: boolean
  setStreaming: Dispatch<SetStateAction<boolean>>
  modelId: string
  /** 会话写入 URL（?c=<id>） */
  onConversationCreated: (conversationId: string) => void
  /** 一轮结束后刷新会话列表（标题/时间/消息数） */
  onTurnFinished: () => void
}

/**
 * 发送 / 流式接收 / 停止 / 重试（交互 + 业务逻辑）。
 * 乐观插入 user + assistant 占位，delta 按 60ms 合并刷新，结束后回填状态。
 */
export function useChatStream({
  activeId,
  setActiveId,
  messages,
  setMessages,
  streaming,
  setStreaming,
  modelId,
  onConversationCreated,
  onTurnFinished,
}: UseChatStreamOptions) {
  const abortRef = useRef<AbortController | null>(null)
  const { flush, queue } = useChatDelta(setMessages)

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim()
      if (!content || streaming) return

      flush()

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
              onConversationCreated(conversationId)
            },
            onMessageId: (messageId) => {
              setMessages((prev) => patchMessage(prev, assistantLocalId, { id: messageId }))
            },
            onDelta: (text) => queue(assistantLocalId, text),
            onStreamError: (message) => {
              flush()
              setMessages((prev) =>
                patchMessage(prev, assistantLocalId, { status: 'error', errorMessage: message }),
              )
            },
            onDone: () => {},
          },
        )

        flush()
        setMessages((prev) =>
          patchStreamingMessage(prev, assistantLocalId, {
            status: controller.signal.aborted ? 'aborted' : 'completed',
          }),
        )
      } catch (err) {
        flush()
        if (controller.signal.aborted) {
          setMessages((prev) =>
            patchStreamingMessage(prev, assistantLocalId, { status: 'aborted' }),
          )
        } else if (err instanceof ApiError) {
          // 失败与模型输出显示在同一位置（消息流内的 assistant 错误气泡，参考 DSH）
          setMessages((prev) =>
            patchStreamingMessage(prev, assistantLocalId, {
              status: 'error',
              errorMessage: err.message,
              errorCode: err.code,
            }),
          )
        } else {
          setMessages((prev) =>
            patchStreamingMessage(prev, assistantLocalId, {
              status: 'error',
              errorMessage: '发送失败，请重试',
              errorCode: -1,
            }),
          )
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        onTurnFinished()
      }
    },
    [
      activeId,
      flush,
      modelId,
      onConversationCreated,
      onTurnFinished,
      queue,
      setActiveId,
      setMessages,
      setStreaming,
      streaming,
    ],
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
  }, [activeId, messages, send, setMessages, streaming])

  return { send, stop, retryLastTurn }
}
