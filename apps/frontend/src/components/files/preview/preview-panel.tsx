'use client'

import { useEffect, useRef, useState, type UIEvent } from 'react'
import { ExternalLink, FileQuestion, FileSearch, Loader2, RotateCcw, WrapText } from 'lucide-react'
import { Button } from '@lyh-next/components'
import { cn } from '@lyh-next/utils'
import { Markdown } from '@/components/chat/markdown/markdown'
import { CodeView } from './code-view'
import { formatBytes, languageForPath, type PreviewKind } from '../constants'
import { useFilePreview } from '../hooks/use-file-preview'

const KIND_LABEL: Record<PreviewKind, string> = {
  text: '文本',
  code: '代码',
  markdown: 'Markdown',
  image: '图片',
  pdf: 'PDF',
  unsupported: '不支持预览',
}

interface PreviewPanelProps {
  workspaceId: string
  /** 当前选中的文件；为空时展示空态 */
  path: string | null
}

/** 右侧预览区：路径头 + 换行/重载 + 正文（文本分页 / 图片 / PDF） */
export function PreviewPanel({ workspaceId, path }: PreviewPanelProps) {
  const preview = useFilePreview(workspaceId, path)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [wrap, setWrap] = useState(false)

  // 切换文件时回到默认不换行
  useEffect(() => {
    setWrap(false)
  }, [path])

  const isTextLike = preview.kind === 'text' || preview.kind === 'code'
  const size = preview.size ?? null

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!isTextLike) return
    const element = event.currentTarget
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) preview.loadMore()
  }

  const openInNewTab = () => {
    if (preview.objectUrl) window.open(preview.objectUrl, '_blank', 'noopener,noreferrer')
  }

  if (!path) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-8">
        <FileSearch className="h-10 w-10" />
        <p className="text-sm">从左侧选择一个文件</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex h-11 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={path}>
            {path}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {preview.kind ? KIND_LABEL[preview.kind] : ''}
            {size === null ? '' : ` · ${formatBytes(size)}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isTextLike ? (
            <button
              type="button"
              onClick={() => setWrap((value) => !value)}
              className={cn(
                'hover:bg-muted rounded-md p-1.5 transition-colors',
                wrap ? 'text-foreground' : 'text-muted-foreground',
              )}
              title={wrap ? '关闭自动换行' : '自动换行'}
              aria-pressed={wrap}
            >
              <WrapText className="h-4 w-4" />
            </button>
          ) : null}
          {(preview.kind === 'image' || preview.kind === 'pdf') && preview.objectUrl ? (
            <button
              type="button"
              onClick={openInNewTab}
              className="text-muted-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
              title="在新窗口打开"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={preview.reload}
            className="text-muted-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
            title="重新读取"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {preview.kind === 'unsupported' ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <FileQuestion className="h-10 w-10" />
          <p className="text-sm">该格式暂不支持预览</p>
          <p className="text-xs">可下载后使用本地应用打开</p>
        </div>
      ) : preview.error && !preview.text ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <p className="text-destructive text-sm">{preview.error}</p>
          <Button variant="outline" size="sm" onClick={preview.reload}>
            重试
          </Button>
        </div>
      ) : preview.kind === 'image' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          {preview.objectUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Blob URL 预览不做图片优化
            <img
              src={preview.objectUrl}
              alt={path}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Loading />
          )}
        </div>
      ) : preview.kind === 'pdf' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {preview.objectUrl ? (
            <iframe
              src={preview.objectUrl}
              title={path}
              className="min-h-0 w-full flex-1 border-0"
            />
          ) : (
            <Loading />
          )}
        </div>
      ) : (
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-auto">
          {preview.text === '' && preview.loading ? <Loading /> : null}
          {preview.text === '' && !preview.loading && !preview.error ? (
            <p className="text-muted-foreground p-6 text-sm">空文件</p>
          ) : null}

          {preview.kind === 'markdown' ? (
            <div className="px-5 py-4">
              <Markdown content={preview.text} />
            </div>
          ) : preview.kind === 'code' ? (
            <CodeView text={preview.text} language={languageForPath(path)} wrap={wrap} />
          ) : (
            <pre
              className={cn(
                'px-4 py-3 font-mono text-xs leading-relaxed',
                wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
              )}
            >
              {preview.text}
            </pre>
          )}

          {!preview.eof && preview.text !== '' ? (
            <div className="flex flex-col items-center gap-2 py-4">
              {preview.error ? <p className="text-destructive text-xs">{preview.error}</p> : null}
              <Button
                variant="outline"
                size="sm"
                onClick={preview.loadMore}
                disabled={preview.loading}
              >
                {preview.loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                加载更多
              </Button>
            </div>
          ) : null}
          {preview.eof && preview.text !== '' ? (
            <p className="text-muted-foreground py-4 text-center text-[11px]">已到文件末尾</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-8">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-xs">读取中…</p>
    </div>
  )
}
