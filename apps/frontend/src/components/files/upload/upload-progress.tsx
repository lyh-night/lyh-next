'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@lyh-next/components'
import { formatBytes } from '../constants'
import type { UploadState } from '../hooks/use-file-upload'

interface UploadProgressProps {
  /** 上传的根文件夹名（工作区名） */
  rootName: string
  state: UploadState
  onCancel: () => void
}

/** 上传阶段的进度卡：文件数、字节进度、当前文件与取消 */
export function UploadProgress({ rootName, state, onCancel }: UploadProgressProps) {
  const { doneFiles, totalFiles, doneBytes, totalBytes, currentPath, failed } = state
  const percent = totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 100

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="border-border bg-card w-full max-w-md space-y-4 rounded-2xl border p-6">
        <div>
          <h2 className="text-sm font-semibold">正在上传「{rootName}」</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {doneFiles}/{totalFiles} 个文件 · {formatBytes(doneBytes)} / {formatBytes(totalBytes)}
          </p>
        </div>

        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className="bg-primary h-full transition-all" style={{ width: `${percent}%` }} />
        </div>

        <p className="text-muted-foreground truncate text-xs" title={currentPath}>
          {failed.length > 0
            ? `${failed.length} 个文件失败：${failed[0].path}`
            : (currentPath ?? '准备中…')}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Loader2 className="h-3 w-3 animate-spin" />
            请保持页面打开
          </span>
          <Button variant="outline" size="sm" onClick={onCancel}>
            取消上传
          </Button>
        </div>
      </div>
    </div>
  )
}
