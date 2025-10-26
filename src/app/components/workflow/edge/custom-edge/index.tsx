'use client'

import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { cn } from '@/utils/classnames'
import { NodeSelector } from '../../operator/node-selector'
import { useWorkflowStore } from '../../store/index'

export default function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const hover_node = useWorkflowStore((state) => state.hover_node)
  const hover_edge = useWorkflowStore((state) => state.hover_edge)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX - 8,
    sourceY,
    sourcePosition,
    targetX: targetX + 8,
    targetY,
    targetPosition,
    curvature: 0.16,
  })

  const _isHoverNode = hover_node == source || hover_node == target
  const _isHover = hover_edge == id

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: _isHoverNode ? '#2b59e6' : '',
          strokeWidth: 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'all',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          className={cn('nodrag nopan')}
        >
          {_isHover ? <NodeSelector edge_id={id} /> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
