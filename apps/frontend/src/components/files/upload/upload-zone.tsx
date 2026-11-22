'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { FolderOpen, UploadCloud } from 'lucide-react'
import { Button } from '@lyh-next/components'
import { toast } from 'sonner'
import { FILE_LIMITS, formatBytes } from '../constants'
import type { UploadEntry } from '../types'

interface UploadZoneProps {
  disabled?: boolean
  /** 校验通过后交给上传流程；rootName 取文件夹第一段，用于工作区名称 */
  onSelect: (entries: UploadEntry[], rootName: string) => void
}

function fromFileList(files: FileList): UploadEntry[] {
  return Array.from(files).map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }))
}

/** 读完一个目录（readEntries 每次最多返回一批，需要循环到空） */
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) return entries
    entries.push(...batch)
  }
}

async function walkEntry(entry: FileSystemEntry, parentPath: string, output: UploadEntry[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    output.push({ file, path: parentPath ? `${parentPath}/${entry.name}` : entry.name })
    return
  }
  if (entry.isDirectory) {
    const directoryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
    for (const child of children) await walkEntry(child, directoryPath, output)
  }
}

function validate(entries: UploadEntry[]): string | null {
  if (entries.length === 0) return '没有可上传的文件'
  if (entries.length > FILE_LIMITS.maxFiles) {
    return `最多上传 ${FILE_LIMITS.maxFiles} 个文件（当前 ${entries.length} 个）`
  }

  const total = entries.reduce((sum, entry) => sum + entry.file.size, 0)
  if (total > FILE_LIMITS.maxTotalBytes) {
    return `文件夹总大小不能超过 ${formatBytes(FILE_LIMITS.maxTotalBytes)}`
  }

  const oversized = entries.find((entry) => entry.file.size > FILE_LIMITS.maxFileBytes)
  if (oversized) {
    return `「${oversized.path}」超过单文件上限 ${formatBytes(FILE_LIMITS.maxFileBytes)}`
  }
  return null
}

/** 文件夹选择/拖拽上传入口：选择后立即开始上传 */
export function UploadZone({ disabled = false, onSelect }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // React 没有 webkitdirectory 的 JSX 类型，直接设置属性
  useEffect(() => {
    inputRef.current?.setAttribute('webkitdirectory', '')
    inputRef.current?.setAttribute('directory', '')
  }, [])

  const accept = useCallback(
    (entries: UploadEntry[]) => {
      const error = validate(entries)
      if (error) {
        toast.error(error)
        return
      }
      const segments = entries[0]?.path.split('/') ?? []
      onSelect(entries, segments.length > 1 ? segments[0] : '上传的文件夹')
    },
    [onSelect],
  )

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) accept(fromFileList(files))
    event.target.value = ''
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return

    const items = Array.from(event.dataTransfer.items)
    const roots = items
      .map((item) => item.webkitGetAsEntry?.() ?? null)
      .filter((entry): entry is FileSystemEntry => entry !== null)

    if (roots.length > 0) {
      const entries: UploadEntry[] = []
      try {
        for (const root of roots) await walkEntry(root, '', entries)
      } catch {
        toast.error('读取文件夹失败，请改用「选择文件夹」')
        return
      }
      accept(entries)
      return
    }

    // 浏览器不支持 Entry API 时退回扁平文件列表（会丢失目录结构）
    if (event.dataTransfer.files.length > 0) accept(fromFileList(event.dataTransfer.files))
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => void handleDrop(event)}
        className={[
          'border-border bg-card flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-2xl border border-dashed px-8 py-14 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/60',
          disabled ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <div className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-full">
          {dragging ? <UploadCloud className="h-7 w-7" /> : <FolderOpen className="h-7 w-7" />}
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">上传一个文件夹</h2>
          <p className="text-muted-foreground text-sm">
            拖拽到这里，或点击选择文件夹；上传完成后在左侧浏览、右侧预览
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation()
            inputRef.current?.click()
          }}
        >
          选择文件夹
        </Button>
        <p className="text-muted-foreground text-xs">
          最多 {FILE_LIMITS.maxFiles} 个文件 · 单文件 {formatBytes(FILE_LIMITS.maxFileBytes)} · 总计{' '}
          {formatBytes(FILE_LIMITS.maxTotalBytes)} · 保留 24 小时
        </p>
      </div>
    </div>
  )
}
