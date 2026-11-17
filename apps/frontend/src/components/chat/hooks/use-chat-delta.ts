'use client'

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { appendMessageContent } from '@/utils/chat-message'
import type { UiMessage } from '../types'

/** delta 合并刷新间隔：流式时 markdown 全量重解析，避免每帧一次 */
const DELTA_FLUSH_MS = 60

/**
 * 流式 delta 节流（交互逻辑）：累积到缓冲区，按 60ms 合并刷一次 setState。
 * 停止/结束时调用 flush 把剩余内容落盘。
 */
export function useChatDelta(setMessages: Dispatch<SetStateAction<UiMessage[]>>) {
  const deltaRef = useRef<{ localId: string; text: string } | null>(null)
  const flushTimerRef = useRef<number | null>(null)

  const flush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    const pending = deltaRef.current
    if (!pending) return
    deltaRef.current = null

    setMessages((prev) => appendMessageContent(prev, pending.localId, pending.text))
  }, [setMessages])

  const queue = useCallback(
    (localId: string, text: string) => {
      const pending = deltaRef.current
      if (pending && pending.localId === localId) {
        pending.text += text
      } else {
        flush()
        deltaRef.current = { localId, text }
      }
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flush, DELTA_FLUSH_MS)
      }
    },
    [flush],
  )

  return { flush, queue }
}
