// 编排边相关事件

import React from 'react'
import type { Edge as ReactFlowEdge } from '@xyflow/react'
import { useWorkflowStore } from '../store/index'

export function useEdgesInteractions() {
  const set_hover_edge = useWorkflowStore((state) => state.set_hover_edge)

  const handleEdgeEnter = (event: React.MouseEvent, edge: ReactFlowEdge) => {
    set_hover_edge(edge.id)
  }
  const handleEdgeLeave = (event: React.MouseEvent, edge: ReactFlowEdge) => {
    set_hover_edge('')
  }
  return {
    handleEdgeEnter,
    handleEdgeLeave,
  }
}
