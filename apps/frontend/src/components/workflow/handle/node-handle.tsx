'use client'

// 句柄
import { Handle, Position } from '@xyflow/react'
import { cn } from '@lyh-next/utils'

export function NodeTargetHandle() {
  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          'z-[1] !h-4 !w-4 !rounded-none !border-none !bg-transparent !outline-none',
          'after:absolute after:right-1.5 after:top-1 after:h-2 after:w-0.5 after:bg-[#296dff]',
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
          'after:absolute after:left-1.5 after:top-1 after:h-2 after:w-0.5 after:bg-[#296dff]',
        )}
      />
    </>
  )
}
