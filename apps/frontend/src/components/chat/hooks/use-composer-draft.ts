'use client'

import { useCallback, useEffect, useState } from 'react'
import { readChatDraft, writeChatDraft } from '@/utils/chat-draft'

/**
 * 输入框草稿（交互逻辑）：按会话恢复/持久化，欢迎建议预填。
 * 草稿写入防抖 300ms，清空即删除。
 */
export function useComposerDraft({
  draftKey,
  seed,
}: {
  draftKey: string
  seed?: { text: string; nonce: number } | null
}) {
  const [value, setValue] = useState('')

  // 切换会话时恢复该会话的草稿（两段式：默认空串，挂载后再读，避免 hydration 不一致）
  useEffect(() => {
    setValue(readChatDraft(draftKey))
  }, [draftKey])

  // 草稿防抖持久化；发送后清空的 '' 会触发删除
  useEffect(() => {
    const timer = window.setTimeout(() => writeChatDraft(draftKey, value), 300)
    return () => window.clearTimeout(timer)
  }, [draftKey, value])

  // 欢迎 hero 建议：预填提示模板（nonce 变化才触发，同文本可重复点击）
  useEffect(() => {
    if (!seed) return
    setValue(seed.text)
  }, [seed])

  /** 发送成功后清空输入 */
  const reset = useCallback(() => setValue(''), [])

  return { value, setValue, reset }
}
