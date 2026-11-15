'use client'

import { isValidElement, memo, useEffect, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Check, Copy, WrapText } from 'lucide-react'
import { cn } from '@lyh-next/utils'
import { highlightCode } from './highlighter'
import { writeTextToClipboard } from '@/utils/clipboard'
import 'katex/dist/katex.min.css'

/** 代码块：语言标签 + 换行开关 + 复制按钮；Shiki 高亮按语言懒加载（DSH 对话同款交互） */
function CodeBlock({
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
    <div className="border-border bg-muted/60 my-3 overflow-hidden rounded-md border">
      <div className="border-border flex h-8 items-center justify-between border-b px-3">
        <span className="text-muted-foreground font-mono text-xs">{language ?? '代码'}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWrapped((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
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
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      {html ? (
        <div
          className={cn(
            'shiki-host p-3 font-mono text-xs leading-relaxed',
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

/** pre 里包的 code 元素：取语言标记 */
function getLanguage(children: ReactNode): string | undefined {
  const node = Array.isArray(children) ? children[0] : children
  if (node && typeof node === 'object' && 'props' in node) {
    const className = (node.props as { className?: string }).className
    return /language-(\S+)/.exec(className ?? '')?.[1]
  }
  return undefined
}

/** 递归取纯文本（供 Shiki 高亮与复制使用） */
function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

const components: Components = {
  h1: ({ children }) => <h1 className="mb-1.5 mt-3 text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2.5 text-sm font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 whitespace-pre-wrap leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground my-2 border-l-2 pl-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-3" />,
  table: ({ children }) => (
    <div className="border-border my-3 overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border bg-muted/60 border-b px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-border border-b px-2 py-1">{children}</td>,
  pre: ({ children }) => (
    <CodeBlock language={getLanguage(children)} codeText={extractText(children)}>
      {children}
    </CodeBlock>
  ),
  code: ({ children, className }) => {
    // 块级代码由 pre 包装渲染样式，这里只处理行内代码
    if (className?.includes('language-')) {
      return <code className={className}>{children}</code>
    }
    if (typeof children === 'string' && children.includes('\n')) {
      return <code>{children}</code>
    }
    return <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  },
}

/** 助手消息 Markdown 渲染：不解析裸 HTML（无 XSS 面），GFM 表格/任务列表、数学公式（KaTeX）可用 */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
