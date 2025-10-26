'use client'

import { Position, NodeToolbar } from '@xyflow/react'
import { NodeProps } from '../../types'
import { cn } from '@/utils/classnames'

import { RiPlayLine } from '@remixicon/react'
import Tooltip from '@/components/tooltip'

import NodeControl from './node-control'

import { NodeTargetHandle, NodeSourceHandle } from '../../handle/node-handle'

import Baseicon from '../../BaseIcon'
import { useWorkflowStore } from '../../store/index'

export interface BaseNodeProps {
  id: string
  data: NodeProps['data']
  children?: React.ReactNode
}

export function BaseNode({ id, data, children }: BaseNodeProps) {
  const hover_node = useWorkflowStore((state) => state.hover_node)
  const active_node = useWorkflowStore((state) => state.active_node)
  return (
    <div
      className={cn(
        'box-border w-[240px] rounded-[15px] border border-[#fff] bg-white p-[12px] text-[#101828]',
        id == hover_node ? 'shadow-xl' : '',
        id == active_node ? 'border-[#2b59e6]' : '',
      )}
    >
      {/* 操作内容 */}
      {(id == active_node || id == hover_node) && (
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
      {data.type != 'start' && !data._isCandidateNode && <NodeSourceHandle></NodeSourceHandle>}
      {data.type != 'end' && !data._isCandidateNode && <NodeTargetHandle></NodeTargetHandle>}
    </div>
  )
}
