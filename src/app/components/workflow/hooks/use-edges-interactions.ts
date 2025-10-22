// 编排边相关事件

import React from 'react'
import { useStoreApi } from '@xyflow/react'
import type { Edge as ReactFlowEdge } from '@xyflow/react'
import { produce } from 'immer'

export function useEdgesInteractions() {
  const store = useStoreApi()

  const handleEdgeEnter = (event: React.MouseEvent, edge: ReactFlowEdge) => {
    const { nodes, edges, setNodes, setEdges } = store.getState()
    const newEdges = produce(edges, (draft) => {
      draft.forEach((item) => {
        if (item.id == edge.id) {
          item.data._isHover = true
        }
      })
    })
    setEdges(newEdges)
  }
  const handleEdgeLeave = (event: React.MouseEvent, edge: ReactFlowEdge) => {
    const { nodes, edges, setNodes, setEdges } = store.getState()
    const newEdges = produce(edges, (draft) => {
      draft.forEach((item) => {
        if (item.id == edge.id) {
          item.data._isHover = false
        }
      })
    })
    setEdges(newEdges)
  }
  return {
    handleEdgeEnter,
    handleEdgeLeave,
  }
}
