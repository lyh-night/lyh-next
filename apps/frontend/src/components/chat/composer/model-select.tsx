'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@lyh-next/components'
import { cn } from '@lyh-next/utils'
import type { ChatModel } from '../types'

interface ModelSelectProps {
  models: ChatModel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

/**
 * 模型选择：本轮对话发送时作为 modelId 传给后端。
 * 用 Popover 而非 Select：空数据也能弹出提示，且弹层向上悬浮、与输入区留出距离。
 */
export function ModelSelect({ models, value, onChange, disabled }: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const selected = models.find((model) => model.id === value)
  const label = selected?.displayName ?? (models.length === 0 ? '无可用模型' : '选择模型')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="hover:bg-accent focus-visible:bg-accent flex w-fit max-w-[220px] items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="选择模型"
          aria-haspopup="listbox"
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')}
          />
        </button>
      </PopoverTrigger>

      {/* 向上弹出，与输入区留 8px 距离 */}
      <PopoverContent side="top" align="end" sideOffset={8} className="w-[240px] p-1">
        {models.length === 0 ? (
          <div className="text-muted-foreground flex flex-col gap-1 px-3 py-2.5 text-xs">
            <span className="text-foreground text-sm font-medium">暂无可用模型</span>
            <span>请在「头像 → 设置 → 模型」中添加后再选择</span>
          </div>
        ) : (
          <div role="listbox" aria-label="模型列表">
            {models.map((model) => {
              const active = model.id === value
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(model.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                    active ? 'bg-accent' : 'hover:bg-accent',
                  )}
                >
                  <span className="truncate">{model.displayName}</span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
