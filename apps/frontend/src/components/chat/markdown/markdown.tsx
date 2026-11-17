'use client'

import { isValidElement, memo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { CodeBlock } from './code-block'
import 'katex/dist/katex.min.css'

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
  h1: ({ children }) => <h1 className="mb-2 mt-5 text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-sm font-semibold">{children}</h4>,
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
  hr: () => <hr className="border-border my-4" />,
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
