'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '../shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  /** 确认按钮文案，默认「确认」 */
  confirmText?: string
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string
  /** 确认按钮使用危险样式（删除类操作） */
  destructive?: boolean
  /** 确认进行中：禁用按钮并切换文案 */
  pending?: boolean
  /** 确认中的按钮文案，默认「处理中…」 */
  pendingText?: string
  onConfirm: () => void
}

/**
 * 通用确认弹窗：删除 / 覆盖 / 危险操作前二次确认。
 * 纯 UI 组合（shadcn Dialog + Button），不含业务与请求逻辑；确认后关闭由调用方控制。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  destructive = false,
  pending = false,
  pendingText = '处理中…',
  onConfirm,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const busy = pending || confirming

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => {
              if (confirming) return
              setConfirming(true)
              try {
                onConfirm()
              } finally {
                setConfirming(false)
              }
            }}
          >
            {busy ? pendingText : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
