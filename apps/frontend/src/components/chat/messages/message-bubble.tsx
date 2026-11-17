'use client'

import { memo } from 'react'
import { AssistantMessage } from './assistant-message'
import { UserMessage } from './user-message'
import type { UiMessage } from '../types'

interface MessageBubbleProps {
  message: UiMessage
  /** 错误码为 30003（无可用模型）时，在错误气泡内给出打开设置的入口 */
  onOpenSettings?: () => void
  /** 仅最后一轮未完成（error / aborted / 无 assistant）时传入：撤回该轮并重发 */
  onRetry?: () => void
}

/** 消息气泡分派：用户消息与助手消息各自独立组件 */
function MessageBubbleBase({ message, onOpenSettings, onRetry }: MessageBubbleProps) {
  if (message.role === 'user') return <UserMessage message={message} />
  return <AssistantMessage message={message} onOpenSettings={onOpenSettings} onRetry={onRetry} />
}

export const MessageBubble = memo(MessageBubbleBase)
