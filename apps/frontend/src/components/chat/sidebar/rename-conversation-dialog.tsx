'use client'

import { useEffect, useState } from 'react'
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
import type { ConversationSummary } from '../types'

interface RenameConversationDialogProps {
  /** 待重命名的会话；null 表示关闭 */
  conversation: ConversationSummary | null
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string, title: string) => Promise<void>
}

/** 重命名会话弹窗：Enter 提交（IME 组合输入不触发），成功后关闭 */
export function RenameConversationDialog({
  conversation,
  onOpenChange,
  onSubmit,
}: RenameConversationDialogProps) {
  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    setTitle(conversation?.title ?? '')
  }, [conversation])

  const confirm = async () => {
    if (!conversation || renaming) return
    setRenaming(true)
    try {
      await onSubmit(conversation.id, title)
      onOpenChange(false)
    } finally {
      setRenaming(false)
    }
  }

  return (
    <Dialog open={Boolean(conversation)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名会话</DialogTitle>
          <DialogDescription>修改会话标题，不影响消息内容。</DialogDescription>
        </DialogHeader>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) void confirm()
          }}
          placeholder="会话标题"
          maxLength={60}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void confirm()} disabled={renaming}>
            {renaming ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
