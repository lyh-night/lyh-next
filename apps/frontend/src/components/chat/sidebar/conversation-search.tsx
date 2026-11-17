'use client'

import { Search } from 'lucide-react'
import { Input } from '@lyh-next/components'

interface ConversationSearchProps {
  value: string
  onChange: (value: string) => void
}

/** 侧栏会话搜索（受控输入，过滤逻辑在 ConversationList 内） */
export function ConversationSearch({ value, onChange }: ConversationSearchProps) {
  return (
    <div className="relative mt-2">
      <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索会话"
        className="h-8 pl-8 text-xs"
      />
    </div>
  )
}
