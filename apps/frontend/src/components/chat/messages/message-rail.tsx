'use client'

import { useEffect, useState } from 'react'
import { cn } from '@lyh-next/utils'
import { messageKey } from '@/utils/chat-message'
import type { UiMessage } from '../types'

/** 消息少于该数量时不显示预览条 */
const RAIL_MIN_MESSAGES = 2
/** 预览描述最大字符数 */
const PREVIEW_DESC_CHARS = 200

/** 预览条悬浮态：某条消息的标题 + 描述 */
interface MessagePreview {
  index: number
  role: 'user' | 'assistant'
  title: string
  description: string
  /** error → 已失败；aborted → 已停止 */
  statusLabel?: '已失败' | '已停止'
}

/** 从消息原文提取预览：标题 = 首行截断；描述 = 首行之后的摘要（单消费者纯函数，随组件） */
function buildPreview(message: UiMessage, index: number): MessagePreview {
  const content = message.content.trim()
  const firstBreak = content.indexOf('\n')
  const title = (firstBreak === -1 ? content : content.slice(0, firstBreak)).trim().slice(0, 60)
  const rest = firstBreak === -1 ? '' : content.slice(firstBreak + 1).trim()
  const description = (rest || (firstBreak === -1 ? '' : content)).slice(0, PREVIEW_DESC_CHARS)

  return {
    index,
    role: message.role,
    title,
    description,
    statusLabel:
      message.status === 'error' ? '已失败' : message.status === 'aborted' ? '已停止' : undefined,
  }
}

interface MessageRailProps {
  messages: UiMessage[]
  /** 当前阅读位置（scrollspy 结果） */
  activeIndex: number
  onLocate: (index: number) => void
}

/** 消息历史预览条：每条消息一个刻度，悬浮预览、点击定位 */
export function MessageRail({ messages, activeIndex, onLocate }: MessageRailProps) {
  const [preview, setPreview] = useState<MessagePreview | null>(null)

  // 切换会话（先清空再加载）时清掉残留预览，避免悬浮面板展示上一个会话的消息
  useEffect(() => {
    setPreview(null)
  }, [messages.length === 0])

  if (messages.length < RAIL_MIN_MESSAGES) return null

  return (
    <>
      <div className="border-border bg-background/80 absolute right-2 top-1/2 z-10 hidden max-h-[70vh] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-full py-2 [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
        {messages.map((message, index) => (
          <button
            key={messageKey(message)}
            type="button"
            onMouseEnter={() => setPreview(buildPreview(message, index))}
            onMouseLeave={() => setPreview((prev) => (prev?.index === index ? null : prev))}
            onFocus={() => setPreview(buildPreview(message, index))}
            onBlur={() => setPreview(null)}
            onClick={() => onLocate(index)}
            className={cn(
              'mx-auto w-1 shrink-0 rounded-full transition-all',
              index === activeIndex
                ? 'bg-foreground h-5'
                : 'bg-border hover:bg-muted-foreground/60 h-3',
            )}
            aria-label={`定位到第 ${index + 1} 条消息`}
          />
        ))}
      </div>

      {/* 悬浮预览面板：非交互，固定在消息区右缘垂直居中，避免溢出视口 */}
      {preview && (
        <div className="bg-popover border-border pointer-events-none absolute right-9 top-1/2 z-20 hidden w-[260px] -translate-y-1/2 rounded-xl border p-3 shadow-md lg:block">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                preview.role === 'user'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {preview.role === 'user' ? '你' : '助手'}
            </span>
            <span className="truncate text-sm font-medium">{preview.title || '（空）'}</span>
            {preview.statusLabel && (
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                {preview.statusLabel}
              </span>
            )}
          </div>
          {preview.description && (
            <p className="text-muted-foreground mt-1.5 line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed">
              {preview.description}
            </p>
          )}
        </div>
      )}
    </>
  )
}
