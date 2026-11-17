'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** 对话内容列默认宽度（≈ max-w-3xl），可拖拽调整并持久化 */
const DEFAULT_COLUMN_WIDTH = 768
const MAX_COLUMN_WIDTH = 2000
/** 内容列拖拽下限 */
export const MIN_COLUMN_WIDTH = 560
/** 拖拽上限 = 消息区宽度 - 该值（始终留边，保持「不满宽」） */
export const COLUMN_MARGIN = 120
const COLUMN_WIDTH_STORAGE_KEY = 'chat:column-width'

/** 传给消息区/拖拽把手的内容列控制句柄 */
export interface ColumnWidthControl {
  rootRef: React.RefObject<HTMLDivElement | null>
  dragging: boolean
  /** 内容列右缘 x 坐标（列居中）：(区域宽 + 列宽) / 2 */
  handleLeft: string
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * 对话内容列宽度（交互逻辑）：初始值持久化、消息区宽度感知、拖拽调整。
 * 有效列宽 = min(存储值, 消息区宽度 - 留边)，保证拖拽把手始终可见。
 */
export function useColumnWidth() {
  // 首帧固定用默认宽度（与 SSR 一致，避免水合不匹配），挂载后再读持久化宽度
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH)
  // 消息区实时宽度：列宽不能超过它（否则拖拽把手会被算到区域外，视觉上「丢失」）
  const [areaWidth, setAreaWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ centerX: number; areaWidth: number } | null>(null)

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= MIN_COLUMN_WIDTH) {
      setColumnWidth(Math.min(stored, MAX_COLUMN_WIDTH))
    }
  }, [])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      setAreaWidth((prev) => (prev === width ? prev : width))
    })
    observer.observe(main)
    return () => observer.disconnect()
  }, [])

  const persistWidth = useCallback((width: number) => {
    setColumnWidth(width)
    try {
      window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, String(width))
    } catch {
      // 隐私模式等场景写入失败可忽略
    }
  }, [])

  // 拖拽内容列右缘：列保持居中，宽度 = 指针到区域中心的水平距离 × 2
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root || event.button !== 0) return
    const rect = root.getBoundingClientRect()
    dragRef.current = { centerX: rect.left + rect.width / 2, areaWidth: rect.width }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    document.body.style.userSelect = 'none'
    setDragging(true)
  }, [])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const maxWidth = Math.max(MIN_COLUMN_WIDTH, drag.areaWidth - COLUMN_MARGIN)
      const width = Math.min(
        Math.max((event.clientX - drag.centerX) * 2, MIN_COLUMN_WIDTH),
        maxWidth,
      )
      persistWidth(Math.round(width))
    },
    [persistWidth],
  )

  const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.userSelect = ''
    setDragging(false)
  }, [])

  // 有效列宽：存储值与「消息区宽度 - 留边」取小，保证把手始终可见
  const effectiveColumnWidth =
    areaWidth > 0
      ? Math.min(
          Math.max(columnWidth, MIN_COLUMN_WIDTH),
          Math.max(MIN_COLUMN_WIDTH, areaWidth - COLUMN_MARGIN),
        )
      : columnWidth

  const control: ColumnWidthControl = {
    rootRef,
    dragging,
    handleLeft: `calc((100% + ${columnWidth}px) / 2)`,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
  }

  return { mainRef, columnWidth, effectiveColumnWidth, control }
}
