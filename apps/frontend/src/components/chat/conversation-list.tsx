'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@lyh-next/components'
import { cn } from '@lyh-next/utils'
import type { ConversationSummary } from './types'

function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''

  const diff = Date.now() - time
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const date = new Date(time)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return sameYear
    ? `${date.getMonth() + 1}/${date.getDate()}`
    : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** 按 updatedAt 把会话分成 今天 / 昨天 / 近 7 天 / 更早（会话列表本身已按时间倒序） */
function groupByTime(conversations: ConversationSummary[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86_400_000
  const weekAgo = startOfToday - 7 * 86_400_000

  const buckets: { label: string; items: ConversationSummary[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '近 7 天', items: [] },
    { label: '更早', items: [] },
  ]

  for (const conversation of conversations) {
    const time = new Date(conversation.updatedAt).getTime()
    if (Number.isNaN(time) || time < weekAgo) buckets[3].items.push(conversation)
    else if (time >= startOfToday) buckets[0].items.push(conversation)
    else if (time >= startOfYesterday) buckets[1].items.push(conversation)
    else buckets[2].items.push(conversation)
  }

  return buckets.filter((bucket) => bucket.items.length > 0)
}

interface ConversationListProps {
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

export function ConversationList({
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
}: ConversationListProps) {
  /** 待删除的会话，非空时展示确认弹窗 */
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null)
  /** 待重命名的会话 */
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  /** 侧栏搜索关键词：匹配标题或最后一条消息预览 */
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return conversations
    return conversations.filter(
      (conversation) =>
        (conversation.title || '').toLowerCase().includes(kw) ||
        (conversation.lastMessage?.content ?? '').toLowerCase().includes(kw),
    )
  }, [conversations, keyword])

  const groups = useMemo(() => groupByTime(filtered), [filtered])

  const openRename = (conversation: ConversationSummary) => {
    setRenameTarget(conversation)
    setRenameTitle(conversation.title || '')
  }

  const confirmRename = async () => {
    if (!renameTarget || renaming) return
    setRenaming(true)
    try {
      await onRename(renameTarget.id, renameTitle)
      setRenameTarget(null)
    } finally {
      setRenaming(false)
    }
  }

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
        <div className="relative mt-2">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索会话"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 px-1 pt-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="bg-muted h-12 animate-pulse rounded-md" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-muted-foreground px-4 pt-6 text-center text-xs">
            还没有会话，发送第一条消息后会自动创建
          </p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground px-4 pt-6 text-center text-xs">
            没有匹配「{keyword.trim()}」的会话
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="text-muted-foreground/70 px-2 pb-1 pt-3 text-[11px] font-medium tracking-wide">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((conversation) => {
                  const active = conversation.id === activeId

                  return (
                    <div
                      key={conversation.id}
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
                          onClick={() => openRename(conversation)}
                          className="text-muted-foreground hover:text-foreground bg-background/90 hover:bg-background flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-colors"
                          aria-label="重命名会话"
                          title="重命名"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(conversation)}
                          className="text-muted-foreground hover:text-destructive bg-background/90 hover:bg-background flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-colors"
                          aria-label="删除会话"
                          title="删除会话"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {!loading && !keyword.trim() && conversations.length < total && (
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="text-muted-foreground hover:text-foreground px-2 py-1 text-xs"
            >
              加载更多（{total - conversations.length}）
            </button>
          </div>
        )}
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

      {/* 重命名弹窗 */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
            <DialogDescription>修改会话标题，不影响消息内容。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) void confirmRename()
            }}
            placeholder="会话标题"
            maxLength={60}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void confirmRename()} disabled={renaming}>
              {renaming ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗（与设置页删除模型同一模式） */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
            <DialogDescription>
              将删除「{deleteTarget?.title || '新对话'}」及其全部消息，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
