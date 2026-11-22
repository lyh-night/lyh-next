'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Trash2,
} from 'lucide-react'
import { cn } from '@lyh-next/utils'
import { previewKindFor, formatBytes } from '../constants'
import type { TreeEntry } from '../types'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children: TreeNode[]
}

function buildTree(entries: TreeEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const entry of entries) {
    const node: TreeNode = { ...entry, children: [] }
    nodes.set(entry.path, node)

    const slash = entry.path.lastIndexOf('/')
    const parent = slash === -1 ? undefined : nodes.get(entry.path.slice(0, slash))
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (items: TreeNode[]) => {
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    })
    for (const item of items) sort(item.children)
  }
  sort(roots)

  return roots
}

function iconFor(node: TreeNode, expanded: boolean) {
  if (node.type === 'directory') {
    return expanded ? (
      <FolderOpen className="text-muted-foreground h-4 w-4 shrink-0" />
    ) : (
      <Folder className="text-muted-foreground h-4 w-4 shrink-0" />
    )
  }

  switch (previewKindFor(node.name)) {
    case 'image':
      return <FileImage className="text-muted-foreground h-4 w-4 shrink-0" />
    case 'code':
      return <FileCode2 className="text-muted-foreground h-4 w-4 shrink-0" />
    case 'markdown':
    case 'text':
      return <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
    default:
      return <File className="text-muted-foreground h-4 w-4 shrink-0" />
  }
}

interface FileTreeProps {
  entries: TreeEntry[]
  loading: boolean
  error: string | null
  truncated: boolean
  selectedPath: string | null
  onSelect: (path: string) => void
  /** 正在删除的条目路径；非空时禁用删除按钮 */
  deletingPath: string | null
  onDelete: (path: string, type: 'file' | 'directory') => void
}

/** 左侧文件树：扁平列表 → 树；目录可折叠，文件点击后右侧预览 */
export function FileTree({
  entries,
  loading,
  error,
  truncated,
  selectedPath,
  onSelect,
  deletingPath,
  onDelete,
}: FileTreeProps) {
  const roots = useMemo(() => buildTree(entries), [entries])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    // 默认展开所有目录，避免用户逐层点开
    setExpanded(
      new Set(entries.filter((entry) => entry.type === 'directory').map((entry) => entry.path)),
    )
  }, [entries])

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const rows: ReactNode[] = []
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      const isExpanded = expanded.has(node.path)
      const isSelected = node.type === 'file' && node.path === selectedPath

      rows.push(
        <div
          key={`node:${node.path}`}
          className={cn(
            'group flex items-center rounded-md pr-1 transition-colors',
            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70',
          )}
          style={{ paddingLeft: depth * 14 + 8 }}
        >
          <button
            type="button"
            onClick={() => {
              if (node.type === 'directory') toggle(node.path)
              else onSelect(node.path)
            }}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px]',
              isSelected && 'font-medium',
            )}
            title={node.size === undefined ? node.name : `${node.name} · ${formatBytes(node.size)}`}
          >
            {node.type === 'directory' ? (
              <ChevronRight
                className={cn(
                  'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform',
                  isExpanded && 'rotate-90',
                )}
              />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            {iconFor(node, isExpanded)}
            <span className="truncate">{node.name}</span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(node.path, node.type)
            }}
            disabled={deletingPath !== null}
            className={cn(
              'text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 rounded p-1 transition-opacity disabled:opacity-40',
              deletingPath === node.path
                ? 'opacity-100'
                : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100',
            )}
            title={`删除 ${node.name}`}
            aria-label={`删除 ${node.name}`}
          >
            {deletingPath === node.path ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>,
      )
      if (node.type === 'directory' && isExpanded) walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex h-9 shrink-0 items-center justify-between border-b px-3">
        <span className="text-muted-foreground text-xs font-medium">文件</span>
        <span className="text-muted-foreground text-[11px]">{entries.length} 项</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? <p className="text-muted-foreground px-2 py-3 text-xs">目录读取中…</p> : null}
        {error ? <p className="text-destructive px-2 py-3 text-xs">{error}</p> : null}
        {!loading && !error && entries.length === 0 ? (
          <p className="text-muted-foreground px-2 py-3 text-xs">文件夹为空</p>
        ) : null}
        {rows}
        {truncated ? (
          <p className="text-muted-foreground px-2 py-3 text-[11px]">
            文件过多，仅显示前 2000 项；请换一个小一点的文件夹
          </p>
        ) : null}
      </div>
    </div>
  )
}
