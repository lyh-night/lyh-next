'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Check, Copy, WrapText } from 'lucide-react'
import { cn, writeTextToClipboard } from '@lyh-next/utils'
import { highlightCode } from './highlighter'

/** 代码块：语言标签 + 换行开关 + 复制按钮；Shiki 高亮按语言懒加载（DSH 对话同款交互） */
export function CodeBlock({
  language,
  codeText,
  children,
}: {
  language?: string
  codeText: string
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const [wrapped, setWrapped] = useState(false)
  const [html, setHtml] = useState<string | null>(null)

  // 流式输入时 codeText 高频变化：防抖 300ms 后异步高亮，未就绪前先展示纯文本
  useEffect(() => {
    setHtml(null)
    if (!codeText) return
    const timer = window.setTimeout(() => {
      void highlightCode(codeText, language ?? '').then((result) => {
        if (result) setHtml(result)
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [codeText, language])

  const copy = async () => {
    await writeTextToClipboard(codeText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border-border bg-muted/60 my-3 overflow-hidden rounded-lg border">
      <div className="border-border flex h-7 items-center justify-between border-b px-3">
        <span className="text-muted-foreground font-mono text-[11px]">{language ?? '代码'}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWrapped((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 text-[11px] transition-colors',
              wrapped ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={wrapped}
            title={wrapped ? '关闭自动换行' : '自动换行'}
          >
            <WrapText className="h-3.5 w-3.5" />
            {wrapped ? '不换行' : '换行'}
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      {html ? (
        <div
          className={cn(
            'shiki-host px-3 py-2.5 font-mono text-xs leading-[1.7]',
            wrapped && '[&_pre]:overflow-x-hidden! [&_pre]:whitespace-pre-wrap',
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          className={cn(
            'text-foreground p-3 font-mono text-xs leading-relaxed',
            wrapped
              ? 'overflow-hidden whitespace-pre-wrap break-words'
              : 'overflow-x-auto whitespace-pre',
          )}
        >
          {children}
        </pre>
      )}
    </div>
  )
}
