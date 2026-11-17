'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { writeTextToClipboard } from '@lyh-next/utils'
import { Markdown } from '../markdown/markdown'
import { MessageError } from './message-error'
import { MessageMeta } from './message-meta'
import type { UiMessage } from '../types'

interface AssistantMessageProps {
  message: UiMessage
  onOpenSettings?: () => void
  onRetry?: () => void
}

/** 助手消息：Markdown 正文 + 流式/错误/停止状态 + 元信息 + 悬浮复制 */
export function AssistantMessage({ message, onOpenSettings, onRetry }: AssistantMessageProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await writeTextToClipboard(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group/msg flex flex-col">
      {message.content ? (
        <Markdown content={message.content} />
      ) : message.status === 'streaming' || message.status === 'error' ? null : (
        <span className="text-muted-foreground/70 text-[11px]">（无内容）</span>
      )}

      {message.status === 'streaming' && (
        <div className="text-muted-foreground/80 mt-1 flex items-center gap-2 text-[11px]">
          <span className="bg-foreground inline-block h-3 w-[2px] animate-pulse" />
          正在输入…
        </div>
      )}

      {(message.status === 'error' || message.status === 'aborted') && (
        <MessageError message={message} onOpenSettings={onOpenSettings} onRetry={onRetry} />
      )}

      {(message.status === 'completed' || message.status === 'aborted') && (
        <MessageMeta message={message} />
      )}

      {(message.status === 'completed' || message.status === 'aborted') && message.content && (
        <div className="text-muted-foreground mt-1 flex items-center opacity-0 transition-opacity group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="hover:bg-accent hover:text-foreground flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors"
            aria-label="复制消息内容"
          >
            {copied ? (
              <Check className="text-primary h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      )}
    </div>
  )
}
