'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@lyh-next/utils'
import { messageKey } from '@/utils/chat-message'
import type { UiMessage } from '../types'

/** 消息少于该数量时不显示预览条 */
const RAIL_MIN_MESSAGES = 2
/** 预览描述最大字符数 */
const PREVIEW_DESC_CHARS = 200
/** 刻度固定槽位：等距使窗口化可纯算术实现（参照 DSH TurnNavigatorRail 的固定间距） */
const SLOT_PX = 20
/** 轨道上下留白（等价原容器 py-2） */
const RAIL_PADDING_PX = 8
/** 视口外额外渲染的刻度数 */
const OVERSCAN = 3

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

/** 消息历史预览条：等距刻度 + 视口窗口化，悬浮预览、点击定位 */
export function MessageRail({ messages, activeIndex, onLocate }: MessageRailProps) {
  const [preview, setPreview] = useState<MessagePreview | null>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const pointerInsideRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })

  const syncViewport = useCallback(() => {
    const el = railRef.current
    if (!el) return
    setViewport((prev) =>
      prev.top === el.scrollTop && prev.height === el.clientHeight
        ? prev
        : { top: el.scrollTop, height: el.clientHeight },
    )
  }, [])

  // 轨道自身滚动时合并到一帧，只做窗口计算
  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      syncViewport()
    })
  }, [syncViewport])

  // 跟随阅读位置：激活刻度不在可视范围时滚动轨道使其居中（参照 DSH rail follow）
  const followActive = useCallback(() => {
    const el = railRef.current
    if (!el || activeIndex < 0) return
    const center = activeIndex * SLOT_PX + SLOT_PX / 2
    const top = el.scrollTop
    const height = el.clientHeight
    if (center >= top + RAIL_PADDING_PX && center <= top + height - RAIL_PADDING_PX) return
    const maxTop = Math.max(0, messages.length * SLOT_PX - height)
    el.scrollTop = Math.max(0, Math.min(center - height / 2, maxTop))
  }, [activeIndex, messages.length])

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    syncViewport()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => syncViewport())
    observer.observe(el)
    return () => observer.disconnect()
  }, [syncViewport])

  useEffect(() => {
    if (pointerInsideRef.current) return
    followActive()
  }, [followActive])

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  // 切换会话（先清空再加载）时清掉残留预览，避免悬浮面板展示上一个会话的消息
  useEffect(() => {
    setPreview(null)
  }, [messages.length === 0])

  if (messages.length < RAIL_MIN_MESSAGES) return null

  const count = messages.length
  // 首帧尚未测量时按轨道最大高度（70vh）估算，避免测量前只渲染 3 个刻度导致逐帧「长高」
  const viewHeight =
    viewport.height > 0
      ? viewport.height
      : typeof window === 'undefined'
        ? 0
        : window.innerHeight * 0.7
  // 窗口化：只渲染视口附近的刻度，上下用等高 spacer 占位（保持总高度与滚动位置）。
  // 激活刻度不在窗口内时由 followActive 把轨道滚过去，不在这里强制包含（否则会一次渲染到激活刻度）
  const start = Math.max(0, Math.min(count - 1, Math.floor(viewport.top / SLOT_PX) - OVERSCAN))
  const end = Math.min(
    count,
    Math.max(start + 1, Math.ceil((viewport.top + viewHeight) / SLOT_PX) + OVERSCAN),
  )

  return (
    <>
      <div
        ref={railRef}
        onScroll={handleScroll}
        onPointerEnter={() => {
          pointerInsideRef.current = true
        }}
        onPointerLeave={() => {
          pointerInsideRef.current = false
          followActive()
        }}
        className="border-border bg-background/80 absolute right-2 top-1/2 z-10 hidden max-h-[70vh] -translate-y-1/2 flex-col overflow-y-auto rounded-full [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden"
      >
        <div className="shrink-0" style={{ height: RAIL_PADDING_PX + start * SLOT_PX }} />
        {Array.from({ length: end - start }, (_, offset) => {
          const index = start + offset
          const message = messages[index]

          return (
            <div
              key={messageKey(message)}
              style={{ height: SLOT_PX }}
              className="relative w-1 shrink-0"
            >
              <button
                type="button"
                onMouseEnter={() => setPreview(buildPreview(message, index))}
                onMouseLeave={() => setPreview((prev) => (prev?.index === index ? null : prev))}
                onFocus={() => setPreview(buildPreview(message, index))}
                onBlur={() => setPreview(null)}
                onClick={() => onLocate(index)}
                className={cn(
                  'absolute left-1/2 top-1/2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all',
                  index === activeIndex
                    ? 'bg-foreground h-5'
                    : 'bg-border hover:bg-muted-foreground/60 h-3',
                )}
                aria-label={`定位到第 ${index + 1} 条消息`}
              />
            </div>
          )
        })}
        <div className="shrink-0" style={{ height: RAIL_PADDING_PX + (count - end) * SLOT_PX }} />
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
