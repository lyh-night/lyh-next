import { cn } from '@lyh-next/utils'
import type { UiMessage } from '@/components/chat/types'

/** 列表 key：优先服务端 id，乐观消息用 localId 兜底 */
export function messageKey(message: UiMessage): string {
  return message.id ?? message.localId
}

/** 消息行的对齐方式：用户靠右、助手靠左 */
export function messageRowClassName(message: UiMessage): string {
  return cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')
}

/** 按 localId 打补丁（返回新数组，供 setState 使用） */
export function patchMessage(
  messages: UiMessage[],
  localId: string,
  patch: Partial<UiMessage>,
): UiMessage[] {
  return messages.map((message) =>
    message.localId === localId ? { ...message, ...patch } : message,
  )
}

/** 追加流式增量内容（返回新数组，供 setState 使用） */
export function appendMessageContent(
  messages: UiMessage[],
  localId: string,
  text: string,
): UiMessage[] {
  return messages.map((message) =>
    message.localId === localId ? { ...message, content: message.content + text } : message,
  )
}

/** 仅当消息仍处于 streaming 时打补丁（结束/中断时忽略迟到回调） */
export function patchStreamingMessage(
  messages: UiMessage[],
  localId: string,
  patch: Partial<UiMessage>,
): UiMessage[] {
  return messages.map((message) =>
    message.localId === localId && message.status === 'streaming'
      ? { ...message, ...patch }
      : message,
  )
}
