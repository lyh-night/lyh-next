'use client'

import { MessageSquareText, Settings2 } from 'lucide-react'
import { Button, EmptyState } from '@lyh-next/components'

/** 欢迎 hero 的场景建议：label 展示，template 预填输入框（点击后由用户补全再发送） */
const SUGGESTIONS = [
  { label: '把这段话翻译成英文', template: '帮我翻译成英文：' },
  { label: '三句话总结一段内容', template: '用三句话总结：' },
  {
    label: '写一个校验手机号的正则',
    template: '写一个校验中国大陆手机号的正则表达式，并解释各部分含义',
  },
  { label: '解释这段代码的作用', template: '解释这段代码：' },
]

interface EmptyStateProps {
  /** 没有任何可用模型时展示设置引导 */
  noModels: boolean
  onOpenSettings: () => void
  onPickSuggestion: (text: string) => void
}

/** 消息区空态：无模型 → 设置引导；有模型 → 欢迎 hero + 场景建议 */
export function ChatEmptyState({ noModels, onOpenSettings, onPickSuggestion }: EmptyStateProps) {
  if (noModels) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="尚未配置可用的 AI 模型"
        description="先在设置里添加一个 OpenAI 兼容模型，再开始对话"
        action={
          <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            打开设置
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col items-center pb-16">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">有什么可以帮你？</h1>
      <p className="text-muted-foreground mt-2 text-[13px]">
        从下面的场景开始，或直接在下方输入你的问题
      </p>
      <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPickSuggestion(suggestion.template)}
            className="border-border hover:bg-accent hover:text-foreground bg-background text-muted-foreground flex h-9 items-center justify-center rounded-lg border px-3 text-[13px] transition-colors"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  )
}
