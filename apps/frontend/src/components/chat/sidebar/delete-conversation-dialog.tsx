'use client'

import { ConfirmDialog } from '@lyh-next/components'
import type { ConversationSummary } from '../types'

interface DeleteConversationDialogProps {
  /** 待删除的会话；null 表示关闭 */
  conversation: ConversationSummary | null
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

/** 删除会话确认弹窗（与设置页删除模型同一模式，统一走 ConfirmDialog） */
export function DeleteConversationDialog({
  conversation,
  onOpenChange,
  onConfirm,
}: DeleteConversationDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(conversation)}
      onOpenChange={onOpenChange}
      title="删除会话"
      description={<>将删除「{conversation?.title || '新对话'}」及其全部消息，此操作不可恢复。</>}
      confirmText="删除"
      destructive
      onConfirm={() => {
        if (conversation) onConfirm(conversation.id)
        onOpenChange(false)
      }}
    />
  )
}
