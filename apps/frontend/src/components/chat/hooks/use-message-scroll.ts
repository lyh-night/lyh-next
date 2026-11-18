'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { UiMessage } from '../types'

/** 距底部小于该值视为贴底（继续自动跟随） */
const BOTTOM_THRESHOLD = 48
/** 阅读位置判定：行 top 距容器顶小于该值视为「已读到」 */
const ACTIVE_OFFSET = 96
/** 锚点屏幕坐标差小于该值视为浏览器已自动补偿，避免二次位移 */
const ANCHOR_EPSILON = 1
/** 顶部边缘（滚动偏移小于该值）加载更早时直接展示新页，不做位置保持 */
const ANCHOR_MIN_SCROLL_TOP = 24

/** 前插补偿用的语义锚点：首条消息 key 与其插入前的屏幕坐标 */
interface AnchorSnapshot {
  key: string | null
  screenTop: number | null
}

/** 按 key 查找已渲染的消息行（不用属性选择器拼接，避免 key 含特殊字符） */
function findRowByKey(el: HTMLDivElement, key: string): HTMLElement | null {
  const rows = el.querySelectorAll<HTMLElement>('[data-message-id]')
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].getAttribute('data-message-id') === key) return rows[index]
  }
  return null
}

/**
 * 阅读位置：对消息行做二分（参照 DSH readVisibleTurn），只读取 O(log n) 次几何，
 * 避免每条消息一次 getBoundingClientRect。行 top 随下标单调递增。
 */
function findActiveIndex(el: HTMLDivElement): number {
  const rows = el.querySelectorAll<HTMLElement>('[data-message-id]')
  const threshold = el.getBoundingClientRect().top + ACTIVE_OFFSET
  let low = 0
  let high = rows.length - 1
  let active = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (rows[mid].getBoundingClientRect().top <= threshold) {
      active = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return active
}

/**
 * 消息区滚动交互：贴底跟随、回到底部、阅读位置（scrollspy）、点击定位与前插锚点补偿。
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
  const [stick, setStick] = useState(true)
  const [activeIndex, setActiveIndex] = useState(-1)
  const frameRef = useRef<number | null>(null)
  const anchorRef = useRef<AnchorSnapshot>({ key: null, screenTop: null })

  const captureAnchor = useCallback((el: HTMLDivElement) => {
    const first = el.querySelector<HTMLElement>('[data-message-id]')
    anchorRef.current = {
      key: first?.getAttribute('data-message-id') ?? null,
      screenTop: first?.getBoundingClientRect().top ?? null,
    }
  }, [])

  const readState = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    stickRef.current = atBottom
    setStick(atBottom)
    const active = findActiveIndex(el)
    setActiveIndex((prev) => (prev === active ? prev : active))
    captureAnchor(el)
  }, [containerRef, captureAnchor])

  // 滚动事件合并到一帧：每帧最多一次几何读取 + 一次状态提交
  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      readState()
    })
  }, [readState])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    captureAnchor(el)
  }, [containerRef, captureAnchor])

  // 内容增长（流式 delta / 追加消息）时贴底跟随
  useEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [messages, scrollToBottom])

  // 加载更早：读者不在顶部边缘时保持当前看到的内容不动（在顶部点按钮时按原行为直接展示新页）。
  // 浏览器原生锚定已补偿时屏幕坐标差≈0，仅在未补偿（如 Safari）时按锚点位移修正 scrollTop。
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prev = anchorRef.current
    if (
      stickRef.current ||
      !prev.key ||
      prev.screenTop === null ||
      el.scrollTop <= ANCHOR_MIN_SCROLL_TOP
    ) {
      captureAnchor(el)
      return
    }
    const first = el.querySelector<HTMLElement>('[data-message-id]')
    if ((first?.getAttribute('data-message-id') ?? null) === prev.key) return // 追加 / 流式增长
    const oldRow = findRowByKey(el, prev.key)
    if (!oldRow) {
      captureAnchor(el) // 会话切换：不补偿
      return
    }
    const delta = oldRow.getBoundingClientRect().top - prev.screenTop
    if (Math.abs(delta) > ANCHOR_EPSILON) {
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
      el.scrollTop = Math.max(0, Math.min(el.scrollTop + delta, maxTop))
    }
    captureAnchor(el)
  }, [messages, containerRef, captureAnchor])

  // 切换会话后回到顶部重新加载，回到底部
  useEffect(() => {
    stickRef.current = true
    setStick(true)
    setActiveIndex(-1)
    scrollToBottom()
  }, [messages.length === 0, scrollToBottom])

  // 卸载时取消待执行的滚动帧
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  /** 回到底部：恢复贴底并清除「回到底部」按钮 */
  const jumpToBottom = useCallback(() => {
    stickRef.current = true
    setStick(true)
    scrollToBottom()
  }, [scrollToBottom])

  // 点击刻度：平滑定位，并先暂停贴底跟随（避免流式增量把视图拉回底部）
  const locateMessage = useCallback(
    (index: number) => {
      const row = containerRef.current?.querySelectorAll<HTMLElement>('[data-message-id]')[index]
      if (!row) return
      stickRef.current = false
      setStick(false)
      row.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [containerRef],
  )

  return { stick, activeIndex, handleScroll, jumpToBottom, locateMessage }
}
