'use client'

import { useCallback, useState } from 'react'
import SettingsDialog from '@/components/settings'
import { Composer } from './composer/composer'
import { useChat } from './hooks/use-chat'
import { useColumnWidth } from './hooks/use-column-width'
import { MessageArea } from './messages/message-area'
import { ConversationSidebar } from './sidebar/conversation-sidebar'

/** 对话主界面：左侧会话栏常驻 + 右侧消息区（内容列宽度可拖拽，参考 DSH 居中布局） */
export default function ChatWorkspace() {
  const chat = useChat()
  const column = useColumnWidth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  /** 欢迎 hero 建议点击后预填给 Composer 的提示模板（nonce 驱动重复点击） */
  const [composerSeed, setComposerSeed] = useState<{ text: string; nonce: number } | null>(null)
  const handlePickSuggestion = useCallback((text: string) => {
    setComposerSeed((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="border-border motion-safe:animate-in motion-safe:fade-in flex w-60 shrink-0 flex-col border-r motion-safe:duration-500 md:w-[272px]">
        <ConversationSidebar
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

      <main ref={column.mainRef} className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="chat-glow" />
        <MessageArea
          messages={chat.messages}
          loadingHistory={chat.loadingHistory}
          hasMoreHistory={chat.hasMoreHistory}
          noModels={chat.models.length === 0}
          columnWidth={column.effectiveColumnWidth}
          column={column.control}
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
          columnWidth={column.effectiveColumnWidth}
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
