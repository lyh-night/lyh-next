'use client'

import { AlertCircle, Ban, RotateCcw } from 'lucide-react'
import { API_CODE } from '@/utils/api'
import { Button } from '@lyh-next/components'
import type { UiMessage } from '../types'

interface MessageErrorProps {
  message: UiMessage
  /** 错误码为 30003（无可用模型）时，在错误气泡内给出打开设置的入口 */
  onOpenSettings?: () => void
  /** 仅最后一轮未完成（error / aborted / 无 assistant）时传入：撤回该轮并重发 */
  onRetry?: () => void
}

/** 助手消息的失败 / 已停止状态行（含重试与设置入口） */
export function MessageError({ message, onOpenSettings, onRetry }: MessageErrorProps) {
  if (message.status === 'error') {
    return (
      <div className="bg-destructive/10 text-destructive mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md px-2.5 py-1.5 text-[11px]">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{message.errorMessage ?? '生成失败'}</span>
        {message.errorCode === API_CODE.CHAT_NO_MODEL && onOpenSettings && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onOpenSettings}
          >
            打开设置
          </Button>
        )}
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={onRetry}
          >
            <RotateCcw className="h-3 w-3" />
            重试
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="text-muted-foreground/80 mt-1 flex items-center gap-2 text-[11px]">
      <span className="flex items-center gap-1">
        <Ban className="h-3.5 w-3.5" />
        已停止生成
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="hover:bg-accent hover:text-foreground flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          重试
        </button>
      )}
    </div>
  )
}
