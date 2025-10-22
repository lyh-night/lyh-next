'use client'

import { Position, NodeToolbar } from '@xyflow/react'
import { NodeProps } from '../../types'
import { cn } from '@/utils/classnames'

import { RiPlayLine } from '@remixicon/react'
import Tooltip from '@/components/tooltip'

import NodeControl from './node-control'

import { NodeTargetHandle, NodeSourceHandle } from '../../handle/node-handle'

import Baseicon from '../../BaseIcon'

export interface BaseNodeProps {
  data: NodeProps['data']
  children?: React.ReactNode
}

export function BaseNode({ data, children }: BaseNodeProps) {
  console.log('🚀 ~ BaseNode ~ data:', data)
  return (
    <div
      className={cn(
        'box-border w-[240px] rounded-[15px] border border-[#fff] bg-white p-[12px] text-[#101828]',
        data?._isHover ? 'shadow-xl' : '',
        data?._isActive ? 'border-[#2b59e6]' : '',
      )}
    >
      {/* 操作内容 */}
      {(data?._isActive || data?._isHover) && (
        <NodeToolbar isVisible={true} position={Position.Top} align="end" offset={0}>
          <div className="mb-[4px] flex gap-[2px] rounded-[4px] bg-white p-[4px]">
            <Tooltip popupContent="运行此步骤">
              <RiPlayLine className="custom-icon" />
            </Tooltip>
            <NodeControl />
          </div>
        </NodeToolbar>
      )}
      <div className="flex items-center">
        <Baseicon name={data.type} className="mr-[10px]" />
        {data.title}
      </div>
      {children}
      {/* 输入输出锚点 */}
      {data.type != 'start' && <NodeSourceHandle></NodeSourceHandle>}
      {data.type != 'end' && <NodeTargetHandle></NodeTargetHandle>}
    </div>
  )
}
