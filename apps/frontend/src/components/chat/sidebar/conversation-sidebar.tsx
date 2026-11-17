'use client'

import { useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import { ConversationList } from './conversation-list'
import { ConversationSearch } from './conversation-search'
import { DeleteConversationDialog } from './delete-conversation-dialog'
import { RenameConversationDialog } from './rename-conversation-dialog'
import type { ConversationSummary } from '../types'

interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  total: number
  activeId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>
  onLoadMore: () => void
  /** 打开设置弹窗（侧栏 footer 入口） */
  onOpenSettings: () => void
}

/** 会话侧栏：新建入口 + 搜索 + 分组列表 + 设置入口 + 重命名/删除弹窗 */
export function ConversationSidebar({
  conversations,
  total,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onLoadMore,
  onOpenSettings,
}: ConversationSidebarProps) {
  /** 待删除的会话，非空时展示确认弹窗 */
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null)
  /** 待重命名的会话 */
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null)
  /** 侧栏搜索关键词 */
  const [keyword, setKeyword] = useState('')

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onNew}
          className="border-border hover:bg-accent hover:text-foreground flex h-8 w-full items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          新建对话
        </button>
        <ConversationSearch value={keyword} onChange={setKeyword} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ConversationList
          conversations={conversations}
          total={total}
          activeId={activeId}
          loading={loading}
          keyword={keyword}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
          onRequestRename={setRenameTarget}
          onRequestDelete={setDeleteTarget}
        />
      </div>

      {/* 侧栏 footer：设置入口 */}
      <div className="border-border border-t p-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          设置
        </button>
      </div>

      <RenameConversationDialog
        conversation={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onSubmit={onRename}
      />
      <DeleteConversationDialog
        conversation={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  )
}
