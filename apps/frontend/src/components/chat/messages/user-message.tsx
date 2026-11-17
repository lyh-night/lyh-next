'use client'

import { formatClockTime } from '@/utils/datetime'
import type { UiMessage } from '../types'

/** 用户消息气泡：右对齐、身份底色、右下收角 */
export function UserMessage({ message }: { message: UiMessage }) {
  return (
    <div className="flex justify-end">
      <div className="bg-muted max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2">
        <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed md:text-sm">
          {message.content}
        </div>
        <div className="text-muted-foreground/80 mt-0.5 text-right text-[11px]">
          {formatClockTime(message.createdAt)}
        </div>
      </div>
    </div>
  )
}
