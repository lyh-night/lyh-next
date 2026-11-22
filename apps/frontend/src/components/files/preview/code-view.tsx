'use client'

import { useEffect, useState } from 'react'
import { cn } from '@lyh-next/utils'
import { highlightCode } from '@/components/chat/markdown/highlighter'

/**
 * 代码预览：复用对话 Markdown 的 Shiki 单例（语言包按需加载）。
 * 未高亮完成前先展示纯文本，避免大文件高亮阻塞首屏。
 */
export function CodeView({
  text,
  language,
  wrap,
}: {
  text: string
  language: string
  wrap: boolean
}) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!text) return

    let active = true
    setHtml(null)
    const timer = window.setTimeout(() => {
      void highlightCode(text, language).then((result) => {
        if (active) setHtml(result)
      })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [text, language])

  return (
    <div
      className={cn(
        'shiki-host min-h-full font-mono text-xs leading-[1.7]',
        wrap && '[&_pre]:whitespace-pre-wrap [&_pre]:break-words',
      )}
    >
      {html ? (
        <div className="px-4 py-3" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className={cn('whitespace-pre px-4 py-3', wrap && 'whitespace-pre-wrap break-words')}>
          {text}
        </pre>
      )}
    </div>
  )
}
