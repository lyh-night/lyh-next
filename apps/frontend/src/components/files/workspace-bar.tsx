'use client'

import { Button } from '@lyh-next/components'
import { formatBytes } from './constants'
import type { WorkspaceMeta } from './types'

interface WorkspaceBarProps {
  workspace: WorkspaceMeta
  /** 上传失败的文件数；> 0 时显示重试入口 */
  failedCount: number
  onRetry: () => void
  onChangeFolder: () => void
}

/** 浏览阶段的顶部栏：工作区信息 + 重试失败项 / 换文件夹 */
export function WorkspaceBar({
  workspace,
  failedCount,
  onRetry,
  onChangeFolder,
}: WorkspaceBarProps) {
  return (
    <div className="border-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{workspace.name}</p>
        <p className="text-muted-foreground text-[11px]">
          {workspace.fileCount} 个文件 · {formatBytes(workspace.totalBytes)} · 24 小时后自动清理
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {failedCount > 0 ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试失败的 {failedCount} 个
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onChangeFolder}>
          换一个文件夹
        </Button>
      </div>
    </div>
  )
}
