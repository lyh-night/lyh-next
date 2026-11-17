import type { UiMessage } from '../types'

/** 助手消息元信息：模型名 + token 用量（无数据时不渲染） */
export function MessageMeta({ message }: { message: UiMessage }) {
  const tokens =
    message.promptTokens !== null && message.promptTokens !== undefined
      ? `${message.promptTokens} + ${message.completionTokens ?? 0} tokens`
      : null
  const meta = [message.modelName, tokens].filter(Boolean).join(' · ')
  if (!meta) return null

  return <div className="text-muted-foreground/80 mt-1.5 text-[11px]">{meta}</div>
}
