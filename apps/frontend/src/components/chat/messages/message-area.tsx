'use client'

import { useRef } from 'react'
import { ArrowDown, ChevronUp } from 'lucide-react'
import { cn } from '@lyh-next/utils'
import { messageKey, messageRowClassName } from '@/utils/chat-message'
import { useMessageScroll } from '../hooks/use-message-scroll'
import type { ColumnWidthControl } from '../hooks/use-column-width'
import { ChatEmptyState } from './empty-state'
import { ColumnResizeHandle } from './column-resize-handle'
import { MessageBubble } from './message-bubble'
import { MessageRail } from './message-rail'
import type { UiMessage } from '../types'

interface MessageAreaProps {
  messages: UiMessage[]
  loadingHistory: boolean
  hasMoreHistory: boolean
  /** 没有任何可用模型时的空态引导 */
  noModels: boolean
  /** 对话内容列宽度（与输入区一致，可拖拽调整） */
  columnWidth: number
  column: ColumnWidthControl
  onLoadOlder: () => void
  onOpenSettings: () => void
  /** 重试最后一轮未完成的回合（撤回后重发） */
  onRetry: () => void
  /** 欢迎 hero 建议点击：预填提示模板到输入框 */
  onPickSuggestion: (text: string) => void
}

/** 消息区：滚动容器 + 加载更早 + 空态 + 消息行 + 预览条 + 列宽把手 + 回到底部 */
export function MessageArea({
  messages,
  loadingHistory,
  hasMoreHistory,
  noModels,
  columnWidth,
  column,
  onLoadOlder,
  onOpenSettings,
  onRetry,
  onPickSuggestion,
}: MessageAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { showJump, activeIndex, handleScroll, jumpToBottom, locateMessage } = useMessageScroll({
    containerRef,
    messages,
  })

  return (
    <div ref={column.rootRef} className="relative min-h-0 flex-1">
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
            <ChatEmptyState
              noModels={noModels}
              onOpenSettings={onOpenSettings}
              onPickSuggestion={onPickSuggestion}
            />
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

      <MessageRail messages={messages} activeIndex={activeIndex} onLocate={locateMessage} />

      <ColumnResizeHandle control={column} />

      {showJump && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="border-border bg-background hover:bg-accent absolute bottom-4 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors"
          aria-label="回到底部"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
