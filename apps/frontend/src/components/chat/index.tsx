'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SettingsDialog from '@/components/settings'
import { Composer } from './composer'
import { ConversationList } from './conversation-list'
import { COLUMN_MARGIN, MIN_COLUMN_WIDTH, MessageList } from './message-list'
import { useChat } from './use-chat'

/** 对话内容列默认宽度（≈ max-w-3xl），可拖拽调整并持久化 */
const DEFAULT_COLUMN_WIDTH = 768
const MAX_COLUMN_WIDTH = 2000
const COLUMN_WIDTH_STORAGE_KEY = 'chat:column-width'

/** 对话主界面：左侧会话栏常驻 + 右侧消息区（内容列宽度可拖拽，参考 DSH 居中布局） */
export default function ChatWorkspace() {
  const chat = useChat()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 首帧固定用默认宽度（与 SSR 一致，避免水合不匹配），挂载后再读持久化宽度
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH)
  // 消息区实时宽度：列宽不能超过它（否则拖拽把手会被算到区域外，视觉上「丢失」）
  const [areaWidth, setAreaWidth] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  /** 欢迎 hero 建议点击后预填给 Composer 的提示模板（nonce 驱动重复点击） */
  const [composerSeed, setComposerSeed] = useState<{ text: string; nonce: number } | null>(null)
  const handlePickSuggestion = useCallback((text: string) => {
    setComposerSeed((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])

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

  // 有效列宽：存储值与「消息区宽度 - 留边」取小，保证把手始终可见
  const effectiveColumnWidth =
    areaWidth > 0
      ? Math.min(
          Math.max(columnWidth, MIN_COLUMN_WIDTH),
          Math.max(MIN_COLUMN_WIDTH, areaWidth - COLUMN_MARGIN),
        )
      : columnWidth

  const handleColumnWidthChange = useCallback((width: number) => {
    setColumnWidth(width)
    try {
      window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, String(width))
    } catch {
      // 隐私模式等场景写入失败可忽略
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="border-border motion-safe:animate-in motion-safe:fade-in flex w-60 shrink-0 flex-col border-r motion-safe:duration-500 md:w-[272px]">
        <ConversationList
          conversations={chat.conversations}
          total={chat.conversationsTotal}
          activeId={chat.activeId}
          loading={chat.loadingConversations}
          onSelect={chat.selectConversation}
          onNew={chat.newConversation}
          onDelete={(id) => void chat.removeConversation(id)}
          onRename={async (id, title) => {
            await chat.renameConversation(id, title)
          }}
          onLoadMore={() => void chat.loadMoreConversations()}
          onOpenSettings={openSettings}
        />
      </aside>

      <main ref={mainRef} className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="chat-glow" />
        <MessageList
          messages={chat.messages}
          loadingHistory={chat.loadingHistory}
          hasMoreHistory={chat.hasMoreHistory}
          noModels={chat.models.length === 0}
          columnWidth={effectiveColumnWidth}
          onColumnWidthChange={handleColumnWidthChange}
          onLoadOlder={() => void chat.loadOlder()}
          onOpenSettings={openSettings}
          onRetry={() => void chat.retryLastTurn()}
          onPickSuggestion={handlePickSuggestion}
        />

        <Composer
          models={chat.models}
          modelId={chat.modelId}
          onModelChange={chat.setModelId}
          streaming={chat.streaming}
          columnWidth={effectiveColumnWidth}
          draftKey={chat.activeId ?? 'new'}
          seed={composerSeed}
          onSend={(content) => void chat.send(content)}
          onStop={chat.stop}
        />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
