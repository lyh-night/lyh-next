'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { UiMessage } from '../types'

/** 距底部小于该值视为贴底（继续自动跟随） */
const BOTTOM_THRESHOLD = 48
/** 阅读位置判定：行 top 距容器顶小于该值视为「已读到」 */
const ACTIVE_OFFSET = 96

/**
 * 消息区滚动交互：贴底跟随、回到底部、阅读位置（scrollspy）与点击定位。
 * DOM 读写集中在此 hook，组件只负责渲染。
 */
export function useMessageScroll({
  containerRef,
  messages,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  messages: UiMessage[]
}) {
  const stickRef = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [containerRef])

  const getRows = useCallback(
    () => containerRef.current?.querySelectorAll<HTMLElement>('[data-message-id]') ?? null,
    [containerRef],
  )

  const handleScroll = useCallback(() => {
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
  }, [containerRef, getRows])

  // 内容增长（流式 delta / 追加消息）时贴底跟随
  useEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [messages, scrollToBottom])

  // 切换会话后回到顶部重新加载，回到底部
  useEffect(() => {
    stickRef.current = true
    setShowJump(false)
    setActiveIndex(-1)
    scrollToBottom()
  }, [messages.length === 0, scrollToBottom])

  /** 回到底部：恢复贴底并清除「回到底部」按钮 */
  const jumpToBottom = useCallback(() => {
    stickRef.current = true
    setShowJump(false)
    scrollToBottom()
  }, [scrollToBottom])

  // 点击刻度：平滑滚动定位到对应消息（scroll-mt-4 预留顶部间距）
  const locateMessage = useCallback(
    (index: number) => {
      const row = getRows()?.[index]
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [getRows],
  )

  return { showJump, activeIndex, handleScroll, jumpToBottom, locateMessage }
}
