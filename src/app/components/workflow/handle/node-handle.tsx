'use client'

// 句柄
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/utils/classnames'

export function NodeTargetHandle() {
  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          'z-[1] !h-4 !w-4 !rounded-none !border-none !bg-transparent !outline-none',
          'after:absolute after:top-1 after:right-1.5 after:h-2 after:w-0.5 after:bg-[#296dff]',
        )}
      />
    </>
  )
}

export function NodeSourceHandle() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          'z-[1] !h-4 !w-4 !rounded-none !border-none !bg-transparent !outline-none',
          'after:absolute after:top-1 after:left-1.5 after:h-2 after:w-0.5 after:bg-[#296dff]',
        )}
      />
    </>
  )
}
