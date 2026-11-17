'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@lyh-next/utils'
import { formatRelativeTime } from '@/utils/datetime'
import type { ConversationSummary } from '../types'

interface ConversationItemProps {
  conversation: ConversationSummary
  active: boolean
  onSelect: (id: string) => void
  onRequestRename: (conversation: ConversationSummary) => void
  onRequestDelete: (conversation: ConversationSummary) => void
}

/** 单个会话项：标题、相对时间、消息数；hover 时出现重命名/删除操作 */
export function ConversationItem({
  conversation,
  active,
  onSelect,
  onRequestRename,
  onRequestDelete,
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group relative rounded-md px-2.5 py-1.5 transition-colors',
        active ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="block w-full pr-12 text-left"
      >
        <span className="block truncate text-[13px] leading-5">
          {conversation.title || '新对话'}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-[11px] leading-4">
          {formatRelativeTime(conversation.updatedAt)}
          {conversation.messageCount > 0 && ` · ${conversation.messageCount} 条`}
        </span>
      </button>
      <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
        <button
          type="button"
          onClick={() => onRequestRename(conversation)}
          className="text-muted-foreground hover:text-foreground bg-background/90 hover:bg-background flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-colors"
          aria-label="重命名会话"
          title="重命名"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(conversation)}
          className="text-muted-foreground hover:text-destructive bg-background/90 hover:bg-background flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-colors"
          aria-label="删除会话"
          title="删除会话"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
