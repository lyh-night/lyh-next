'use client'

import { GripVertical } from 'lucide-react'
import { cn } from '@lyh-next/utils'
import type { ColumnWidthControl } from '../hooks/use-column-width'

/** 内容列右缘拖拽把手：纯展示，手势由 useColumnWidth 提供 */
export function ColumnResizeHandle({ control }: { control: ColumnWidthControl }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整对话内容宽度"
      className="group/handle absolute inset-y-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none md:block"
      style={{ left: control.handleLeft }}
      onPointerDown={control.onPointerDown}
      onPointerMove={control.onPointerMove}
      onPointerUp={control.onPointerEnd}
      onPointerCancel={control.onPointerEnd}
    >
      <div
        className={cn(
          'bg-background border-border text-muted-foreground absolute left-1/2 top-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-opacity',
          control.dragging ? 'opacity-100' : 'opacity-0 group-hover/handle:opacity-100',
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  )
}
