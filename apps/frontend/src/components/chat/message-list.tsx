'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ChevronUp, GripVertical, MessageSquareText, Settings2 } from 'lucide-react'
import { Button } from '@lyh-next/components'
import { cn } from '@lyh-next/utils'
import { messageKey, MessageBubble, messageRowClassName } from './message-bubble'
import type { UiMessage } from './types'

/** 距底部小于该值视为贴底（继续自动跟随） */
const BOTTOM_THRESHOLD = 48
/** 内容列拖拽下限 */
export const MIN_COLUMN_WIDTH = 560
/** 拖拽上限 = 消息区宽度 - 该值（始终留边，保持「不满宽」） */
export const COLUMN_MARGIN = 120
/** 阅读位置判定：行 top 距容器顶小于该值视为「已读到」 */
const ACTIVE_OFFSET = 96
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

/** 从消息原文提取预览：标题 = 首行截断；描述 = 首行之后的摘要 */
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

/** 欢迎 hero 的场景建议：label 展示，template 预填输入框（点击后由用户补全再发送） */
const SUGGESTIONS = [
  { label: '把这段话翻译成英文', template: '帮我翻译成英文：' },
  { label: '三句话总结一段内容', template: '用三句话总结：' },
  {
    label: '写一个校验手机号的正则',
    template: '写一个校验中国大陆手机号的正则表达式，并解释各部分含义',
  },
  { label: '解释这段代码的作用', template: '解释这段代码：' },
]

interface MessageListProps {
  messages: UiMessage[]
  loadingHistory: boolean
  hasMoreHistory: boolean
  /** 没有任何可用模型时的空态引导 */
  noModels: boolean
  /** 对话内容列宽度（与输入区一致，可拖拽调整） */
  columnWidth: number
  onColumnWidthChange: (width: number) => void
  onLoadOlder: () => void
  onOpenSettings: () => void
  /** 重试最后一轮未完成的回合（撤回后重发） */
  onRetry: () => void
  /** 欢迎 hero 建议点击：预填提示模板到输入框 */
  onPickSuggestion: (text: string) => void
}

export function MessageList({
  messages,
  loadingHistory,
  hasMoreHistory,
  noModels,
  columnWidth,
  onColumnWidthChange,
  onLoadOlder,
  onOpenSettings,
  onRetry,
  onPickSuggestion,
}: MessageListProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const dragRef = useRef<{ centerX: number; areaWidth: number } | null>(null)
  const [showJump, setShowJump] = useState(false)
  const [dragging, setDragging] = useState(false)
  // 预览条：当前阅读位置 + 悬浮预览内容
  const [activeIndex, setActiveIndex] = useState(-1)
  const [preview, setPreview] = useState<MessagePreview | null>(null)

  const scrollToBottom = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  const getRows = () =>
    containerRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? null

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const stick = distance < BOTTOM_THRESHOLD
    stickRef.current = stick
    setShowJump(!stick)

    // 参照 DSH scrollspy 思想：最后一个 top 越过容器顶部的消息 = 当前阅读位置
    const rows = getRows()
    if (!rows || rows.length === 0) return
    const containerTop = el.getBoundingClientRect().top
    let active = -1
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index].getBoundingClientRect().top <= containerTop + ACTIVE_OFFSET) active = index
    }
    setActiveIndex((prev) => (prev === active ? prev : active))
  }

  // 内容增长（流式 delta / 追加消息）时贴底跟随
  useEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [messages])

  // 切换会话后回到顶部重新加载，回到底部
  useEffect(() => {
    stickRef.current = true
    setShowJump(false)
    setActiveIndex(-1)
    setPreview(null)
    scrollToBottom()
  }, [messages.length === 0])

  // 拖拽内容列右缘：列保持居中，宽度 = 指针到区域中心的水平距离 × 2
  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root || event.button !== 0) return
    const rect = root.getBoundingClientRect()
    dragRef.current = { centerX: rect.left + rect.width / 2, areaWidth: rect.width }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    document.body.style.userSelect = 'none'
    setDragging(true)
  }

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const maxWidth = Math.max(MIN_COLUMN_WIDTH, drag.areaWidth - COLUMN_MARGIN)
    const width = Math.min(Math.max((event.clientX - drag.centerX) * 2, MIN_COLUMN_WIDTH), maxWidth)
    onColumnWidthChange(Math.round(width))
  }

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.userSelect = ''
    setDragging(false)
  }

  // 点击刻度：平滑滚动定位到对应消息（scroll-mt-4 预留顶部间距）
  const locateMessage = (index: number) => {
    const row = getRows()?.[index]
    if (!row) return
    row.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 内容列右缘 x 坐标（列居中）：(区域宽 + 列宽) / 2
  const handleLeft = `calc((100% + ${columnWidth}px) / 2)`

  return (
    <div ref={rootRef} className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="motion-safe:animate-in motion-safe:fade-in h-full overflow-y-auto px-4 py-6 motion-safe:duration-500 md:px-6"
      >
        {hasMoreHistory && messages.length > 0 && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loadingHistory}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] transition-colors disabled:opacity-50"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              {loadingHistory ? '加载中…' : '加载更早消息'}
            </button>
          </div>
        )}

        {messages.length === 0 && !loadingHistory ? (
          <div className="flex h-full flex-col items-center justify-center">
            {noModels ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2">
                <MessageSquareText className="text-muted-foreground/50 h-7 w-7" />
                <p className="text-foreground text-sm font-medium">尚未配置可用的 AI 模型</p>
                <p className="text-xs">先在设置里添加一个 OpenAI 兼容模型，再开始对话</p>
                <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>
                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                  打开设置
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center pb-16">
                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                  有什么可以帮你？
                </h1>
                <p className="text-muted-foreground mt-2 text-[13px]">
                  从下面的场景开始，或直接在下方输入你的问题
                </p>
                <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => onPickSuggestion(suggestion.template)}
                      className="border-border hover:bg-accent hover:text-foreground bg-background text-muted-foreground flex h-9 items-center justify-center rounded-lg border px-3 text-[13px] transition-colors"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: columnWidth }}>
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1

              return (
                <div
                  key={messageKey(message)}
                  data-message-id={messageKey(message)}
                  className={cn(messageRowClassName(message), 'scroll-mt-4')}
                >
                  <div
                    className={
                      message.role === 'assistant' ? 'w-full max-w-full' : 'w-full max-w-[80%]'
                    }
                  >
                    <MessageBubble
                      message={message}
                      onOpenSettings={onOpenSettings}
                      onRetry={isLast ? onRetry : undefined}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 消息历史预览条：每条消息一个刻度，悬浮预览、点击定位 */}
      {messages.length >= RAIL_MIN_MESSAGES && (
        <div className="border-border bg-background/80 absolute right-2 top-1/2 z-10 hidden max-h-[70vh] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-full py-2 [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden">
          {messages.map((message, index) => (
            <button
              key={messageKey(message)}
              type="button"
              onMouseEnter={() => setPreview(buildPreview(message, index))}
              onMouseLeave={() => setPreview((prev) => (prev?.index === index ? null : prev))}
              onFocus={() => setPreview(buildPreview(message, index))}
              onBlur={() => setPreview(null)}
              onClick={() => locateMessage(index)}
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
      )}

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

      {/* 内容列右缘拖拽把手：悬浮显示图标，拖动调整列宽（不随内容滚动） */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整对话内容宽度"
        className="group/handle absolute inset-y-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none md:block"
        style={{ left: handleLeft }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div
          className={cn(
            'bg-background border-border text-muted-foreground absolute left-1/2 top-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-opacity',
            dragging ? 'opacity-100' : 'opacity-0 group-hover/handle:opacity-100',
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true
            setShowJump(false)
            scrollToBottom()
          }}
          className="border-border bg-background hover:bg-accent absolute bottom-4 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors"
          aria-label="回到底部"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
