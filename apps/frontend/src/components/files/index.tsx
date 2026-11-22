'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { removeEntry } from './api'
import { FileTree } from './sidebar/file-tree'
import { PreviewPanel } from './preview/preview-panel'
import { UploadProgress } from './upload/upload-progress'
import { UploadZone } from './upload/upload-zone'
import { WorkspaceBar } from './workspace-bar'
import { useFileTree } from './hooks/use-file-tree'
import { useFileUpload } from './hooks/use-file-upload'
import { useFileWorkspace } from './hooks/use-file-workspace'
import type { UploadEntry } from './types'

/**
 * 文件预览页 controller 视图：
 * 上传引导 → 上传进度 → 左侧文件树 + 右侧预览。
 * 当前工作区写入 `?ws=<id>`，刷新/深链可恢复（24 小时内）。
 */
export default function FilesWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialWorkspaceId = searchParams.get('ws')

  const workspaceState = useFileWorkspace(initialWorkspaceId)
  const workspace = workspaceState.workspace
  const tree = useFileTree(workspace?.id ?? null)
  const upload = useFileUpload()

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [uploadRoot, setUploadRoot] = useState<string | null>(null)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)

  const syncUrl = useCallback(
    (id: string | null) => {
      router.replace(id ? `${pathname}?ws=${encodeURIComponent(id)}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  // 切换工作区时清空选中文件；目录加载后自动选中第一个文件
  useEffect(() => {
    setSelectedPath(null)
  }, [workspace?.id])

  useEffect(() => {
    if (selectedPath) return
    const first = tree.entries.find((entry) => entry.type === 'file')
    if (first) setSelectedPath(first.path)
  }, [tree.entries, selectedPath])

  const handlePick = async (entries: UploadEntry[], rootName: string) => {
    if (upload.state.status === 'uploading') return
    try {
      const meta = await workspaceState.create(rootName)
      syncUrl(meta.id)
      setUploadRoot(rootName)
      await upload.run(meta.id, entries)
      await tree.reload(meta.id)
      await workspaceState.refresh(meta.id)
    } catch {
      // 创建失败：request 已弹 toast，留在上传引导页
    }
  }

  const handleRetry = async () => {
    if (!workspace) return
    await upload.retry(workspace.id)
    await tree.reload(workspace.id)
    await workspaceState.refresh(workspace.id).catch(() => undefined)
  }

  const handleDeleteEntry = async (path: string, type: 'file' | 'directory') => {
    if (!workspace || deletingPath) return

    const name = path.split('/').pop() ?? path
    const label = type === 'directory' ? `目录「${name}」及其中所有文件` : `文件「${name}」`
    if (!window.confirm(`确定删除${label}？此操作不可恢复。`)) return

    setDeletingPath(path)
    try {
      await removeEntry(workspace.id, path)
      // 当前预览的文件被删除（或位于被删目录内）时清空选中
      if (selectedPath === path || selectedPath?.startsWith(`${path}/`)) {
        setSelectedPath(null)
      }
      await tree.reload(workspace.id)
      await workspaceState.refresh(workspace.id).catch(() => undefined)
    } catch {
      // 删除失败已由 request 统一弹 toast
    } finally {
      setDeletingPath(null)
    }
  }

  const handleChangeFolder = async () => {
    if (!workspace) return
    if (!window.confirm('换文件夹会删除当前已上传的文件，确定继续？')) return

    try {
      await workspaceState.remove(workspace.id)
    } catch {
      // 已过期或网络失败也允许离开；残留目录由后端 TTL 清理
      workspaceState.forget()
    }
    upload.reset()
    setUploadRoot(null)
    setSelectedPath(null)
    syncUrl(null)
  }

  if (workspaceState.restoring) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在打开文件夹…</span>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {workspaceState.error ? (
          <p className="text-destructive px-4 pt-4 text-center text-sm">{workspaceState.error}</p>
        ) : null}
        <UploadZone onSelect={(entries, rootName) => void handlePick(entries, rootName)} />
      </div>
    )
  }

  if (upload.state.status === 'uploading') {
    return (
      <UploadProgress
        rootName={uploadRoot ?? workspace.name}
        state={upload.state}
        onCancel={upload.cancel}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceBar
        workspace={workspace}
        failedCount={upload.state.failed.length}
        onRetry={() => void handleRetry()}
        onChangeFolder={() => void handleChangeFolder()}
      />

      {upload.state.failed.length > 0 ? (
        <p className="bg-destructive/10 text-destructive px-4 py-2 text-xs">
          有 {upload.state.failed.length} 个文件上传失败，可点击右上角重试；已上传的文件可先浏览。
        </p>
      ) : null}
      {upload.state.status === 'cancelled' ? (
        <p className="bg-muted text-muted-foreground px-4 py-2 text-xs">
          上传已取消，当前只显示已完成上传的文件。
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="border-border flex w-[260px] shrink-0 flex-col border-r">
          <FileTree
            entries={tree.entries}
            loading={tree.loading}
            error={tree.error}
            truncated={tree.truncated}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            deletingPath={deletingPath}
            onDelete={(path, type) => void handleDeleteEntry(path, type)}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <PreviewPanel workspaceId={workspace.id} path={selectedPath} />
        </main>
      </div>
    </div>
  )
}
