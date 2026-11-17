'use client'

import { useEffect, useRef } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Button, Textarea } from '@lyh-next/components'
import { useComposerDraft } from '../hooks/use-composer-draft'
import { ModelSelect } from './model-select'
import type { ChatModel } from '../types'

const CONTENT_MAX_CHARS = 8000
/** Textarea 自适应最大高度（8 行左右） */
const MAX_TEXTAREA_HEIGHT = 192

interface ComposerProps {
  models: ChatModel[]
  modelId: string
  onModelChange: (id: string) => void
  streaming: boolean
  /** 对话内容列宽度（与消息区一致，可拖拽调整） */
  columnWidth: number
  /** 草稿归属键：会话 id 或 'new'，切换会话时恢复/保存各自的草稿 */
  draftKey: string
  /** 欢迎 hero 建议点击后预填的提示模板（nonce 变化触发） */
  seed?: { text: string; nonce: number } | null
  onSend: (content: string) => void
  onStop: () => void
}

/** 输入区：草稿恢复/持久化、自适应高度、字数上限、发送与停止 */
export function Composer({
  models,
  modelId,
  onModelChange,
  streaming,
  columnWidth,
  draftKey,
  seed,
  onSend,
  onStop,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { value, setValue, reset } = useComposerDraft({ draftKey, seed })

  // 欢迎 hero 建议预填后聚焦输入框
  useEffect(() => {
    if (seed) textareaRef.current?.focus()
  }, [seed])

  // 内容变化后自适应高度（field-sizing 在部分浏览器不可用，JS 兜底）
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  const trimmed = value.trim()
  const overLimit = trimmed.length > CONTENT_MAX_CHARS
  const noModel = models.length === 0
  const canSend = !streaming && trimmed.length > 0 && !overLimit && !noModel

  const submit = () => {
    if (!canSend) return
    onSend(trimmed)
    reset()
    // 发送后聚焦，连续对话不用再点输入框
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 组合输入中的 Enter 不触发发送
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="bg-background border-border shrink-0 border-t px-4 py-3 md:px-6">
      <div className="mx-auto" style={{ maxWidth: columnWidth }}>
        {/* DSH 风格：一个圆角容器，内部无边框 textarea + 底部控制行 */}
        <div className="border-border bg-background focus-within:border-foreground/25 rounded-xl border shadow-sm transition-colors">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift + Enter 换行"
            rows={3}
            className="placeholder:text-muted-foreground/80 max-h-48 min-h-[80px] resize-none rounded-b-none border-0 bg-transparent px-3 pt-3 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span
              className={`text-xs ${
                overLimit ? 'text-destructive font-medium' : 'text-muted-foreground/70'
              }`}
            >
              {trimmed.length > CONTENT_MAX_CHARS / 2
                ? `${trimmed.length}/${CONTENT_MAX_CHARS}`
                : ''}
            </span>

            <div className="flex items-center gap-1">
              <ModelSelect
                models={models}
                value={modelId}
                onChange={onModelChange}
                disabled={streaming}
              />

              {streaming ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={onStop}
                  aria-label="停止生成"
                  title="停止生成"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label="发送"
                  title="发送"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
