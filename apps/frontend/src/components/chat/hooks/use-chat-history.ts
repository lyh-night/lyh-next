'use client'

import { useCallback, useRef, useState } from 'react'
import { getHistory } from '../api'
import type { ServerMessage, UiMessage } from '../types'

/** 历史消息分页大小 */
const HISTORY_PAGE_SIZE = 50

function toUiMessage(message: ServerMessage): UiMessage {
  return { ...message, localId: message.id }
}

/**
 * 消息历史（业务逻辑）：首屏加载与「加载更早」游标分页。
 * 用递增 seq 丢弃过期响应，避免快速切换会话时的竞态。
 */
export function useChatHistory() {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const seqRef = useRef(0)

  const loadHistory = useCallback(async (conversationId: string) => {
    const seq = ++seqRef.current
    setLoadingHistory(true)
    try {
      const result = await getHistory(conversationId, { limit: HISTORY_PAGE_SIZE })
      if (seq !== seqRef.current) return
      setMessages(result.items.map(toUiMessage))
      setHasMoreHistory(result.hasMore)
    } catch {
      if (seq === seqRef.current) {
        setMessages([])
        setHasMoreHistory(false)
      }
    } finally {
      if (seq === seqRef.current) setLoadingHistory(false)
    }
  }, [])

  const loadOlder = useCallback(
    async (conversationId: string) => {
      if (!conversationId || !hasMoreHistory || loadingHistory) return
      const anchor = messages[0]
      if (!anchor?.id) return

      const seq = ++seqRef.current
      setLoadingHistory(true)
      try {
        const result = await getHistory(conversationId, {
          messageId: anchor.id,
          limit: HISTORY_PAGE_SIZE,
        })
        if (seq !== seqRef.current) return
        setMessages((prevAvailable) => [...result.items.map(toUiMessage), ...prevAvailable])
        setHasMoreHistory(result.hasMore)
      } catch {
        // toast 已弹，保持现状
      } finally {
        if (seq === seqRef.current) setLoadingHistory(false)
      }
    },
    [hasMoreHistory, loadingHistory, messages],
  )

  /** 切换会话/新建会话时清空当前消息（递增 seq 丢弃在途响应） */
  const reset = useCallback(() => {
    seqRef.current += 1
    setMessages([])
  }, [])

  return { messages, setMessages, loadingHistory, hasMoreHistory, loadHistory, loadOlder, reset }
}
