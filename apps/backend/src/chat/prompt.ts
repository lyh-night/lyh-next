/**
 * 上下文装配：多轮记忆在后端，由这里决定「这轮请求到底带哪些历史给上游」。
 *
 * 规则：
 * - 首条固定为 system（会话自定义 → 默认常量）
 * - 只保留最近 MAX_HISTORY_MESSAGES 条
 * - 总字符超过 MAX_CONTEXT_CHARS 时，从最旧的消息开始丢（当前这轮 user 永远保留）
 * - 裁剪后不以 assistant 开头，避免上下文从「助手回复」开始
 */

export type PromptRole = 'system' | 'user' | 'assistant'

export interface PromptMessage {
  role: PromptRole
  content: string
}

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'
export const MAX_HISTORY_MESSAGES = 20
export const MAX_CONTEXT_CHARS = 12_000

export function buildContext(params: {
  systemPrompt?: string | null
  history: readonly PromptMessage[]
}): PromptMessage[] {
  const system = params.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  const history = params.history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({ ...message }))

  let totalChars = history.reduce((sum, message) => sum + message.content.length, 0)
  while (totalChars > MAX_CONTEXT_CHARS && history.length > 1) {
    const removed = history.shift()
    if (!removed) break
    totalChars -= removed.content.length
  }

  while (history.length > 1 && history[0]?.role === 'assistant') {
    history.shift()
  }

  return [{ role: 'system', content: system }, ...history]
}
