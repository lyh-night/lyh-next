'use client'

import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { cn } from '@/utils/classnames'
import { NodeSelector } from '../../operator/node-selector'

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX - 8,
    sourceY,
    sourcePosition,
    targetX: targetX + 8,
    targetY,
    targetPosition,
    curvature: 0.16,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: data?._isHoverNode ? '#2b59e6' : '',
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
          {data?._isHover ? <NodeSelector edge_id={id} /> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
