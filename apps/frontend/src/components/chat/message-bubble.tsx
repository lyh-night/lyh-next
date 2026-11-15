'use client'

import { memo, useState } from 'react'
import { AlertCircle, Ban, Check, Copy, RotateCcw } from 'lucide-react'
import { API_CODE } from '@/utils/api'
import { writeTextToClipboard } from '@/utils/clipboard'
import { Button } from '@lyh-next/components'
import { cn } from '@lyh-next/utils'
import { Markdown } from './markdown'
import type { UiMessage } from './types'

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function MessageMeta({ message }: { message: UiMessage }) {
  if (message.role !== 'assistant') return null

  const tokens =
    message.promptTokens !== null && message.promptTokens !== undefined
      ? `${message.promptTokens} + ${message.completionTokens ?? 0} tokens`
      : null
  const meta = [message.modelName, tokens].filter(Boolean).join(' · ')
  if (!meta) return null

  return <div className="text-muted-foreground/80 mt-1.5 text-[11px]">{meta}</div>
}

interface MessageBubbleProps {
  message: UiMessage
  /** 错误码为 30003（无可用模型）时，在错误气泡内给出打开设置的入口 */
  onOpenSettings?: () => void
  /** 仅最后一轮未完成（error / aborted / 无 assistant）时传入：撤回该轮并重发 */
  onRetry?: () => void
}

function MessageBubbleBase({ message, onOpenSettings, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await writeTextToClipboard(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-muted max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2">
          <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed md:text-sm">
            {message.content}
          </div>
          <div className="text-muted-foreground/80 mt-0.5 text-right text-[11px]">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    )
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

      {message.status === 'error' && (
        <div className="bg-destructive/10 text-destructive mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md px-2.5 py-1.5 text-[11px]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{message.errorMessage ?? '生成失败'}</span>
          {message.errorCode === API_CODE.CHAT_NO_MODEL && onOpenSettings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onOpenSettings}
            >
              打开设置
            </Button>
          )}
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={onRetry}
            >
              <RotateCcw className="h-3 w-3" />
              重试
            </Button>
          )}
        </div>
      )}

      {message.status === 'aborted' && (
        <div className="text-muted-foreground/80 mt-1 flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1">
            <Ban className="h-3.5 w-3.5" />
            已停止生成
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="hover:bg-accent hover:text-foreground flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              重试
            </button>
          )}
        </div>
      )}

      {message.status === 'completed' && <MessageMeta message={message} />}
      {message.status === 'aborted' && <MessageMeta message={message} />}

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

export const MessageBubble = memo(MessageBubbleBase)

export function messageKey(message: UiMessage) {
  return message.id ?? message.localId
}

export function messageRowClassName(message: UiMessage) {
  return cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')
}
