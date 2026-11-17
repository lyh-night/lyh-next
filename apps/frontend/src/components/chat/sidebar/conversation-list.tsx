'use client'

import { useMemo } from 'react'
import { ConversationItem } from './conversation-item'
import type { ConversationSummary } from '../types'

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
  /** 搜索关键词：过滤标题与最后一条消息预览 */
  keyword: string
  onSelect: (id: string) => void
  onLoadMore: () => void
  onRequestRename: (conversation: ConversationSummary) => void
  onRequestDelete: (conversation: ConversationSummary) => void
}

/** 时间分组会话列表（纯展示 + 过滤/分组纯函数） */
export function ConversationList({
  conversations,
  total,
  activeId,
  loading,
  keyword,
  onSelect,
  onLoadMore,
  onRequestRename,
  onRequestDelete,
}: ConversationListProps) {
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

  if (loading) {
    return (
      <div className="space-y-2 px-1 pt-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="bg-muted h-12 animate-pulse rounded-md" />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <p className="text-muted-foreground px-4 pt-6 text-center text-xs">
        还没有会话，发送第一条消息后会自动创建
      </p>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground px-4 pt-6 text-center text-xs">
        没有匹配「{keyword.trim()}」的会话
      </p>
    )
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          <div className="text-muted-foreground/70 px-2 pb-1 pt-3 text-[11px] font-medium tracking-wide">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                onSelect={onSelect}
                onRequestRename={onRequestRename}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {!keyword.trim() && conversations.length < total && (
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
    </>
  )
}
