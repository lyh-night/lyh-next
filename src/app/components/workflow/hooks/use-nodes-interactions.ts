// 编排节点相关事件
import React from 'react'
import { useStoreApi, getConnectedEdges } from '@xyflow/react'
import type { Node } from '../types'
import { produce } from 'immer'
import { cloneDeep } from 'lodash-es'

import { useWorkflowStore } from '../store/index'

export function useNodesInteractions() {
  const store = useStoreApi()
  const set_panel_show = useWorkflowStore((state) => state.set_panel_show)
  // 移动节点
  const handleNodeDragStart = (event: React.MouseEvent, node: Node) => {
    // console.log(node, 'drag start')
  }
  const handleNodeDrag = (event: React.MouseEvent, node: Node) => {
    // console.log(node, 'drag')
  }
  const handleNodeDragStop = (event: React.MouseEvent, node: Node) => {
    // console.log(node, 'drag stop')
  }
  // 悬浮节点
  const handleNodeEnter = (event: React.MouseEvent, node: Node) => {
    const { nodes, edges, setNodes, setEdges } = store.getState()
    const newNodes = produce(nodes, (draft) => {
      draft.forEach((item) => {
        item.data._isHover = item.id === node.id
      })
    })
    setNodes(newNodes)
    // 节点两边的边
    const newEdges = produce(edges, (draft) => {
      draft.forEach((item) => {
        item.data._isHoverNode = item.source == node.id || item.target == node.id
      })
    })
    setEdges(newEdges)
  }
  const handleNodeLeave = (event: React.MouseEvent, node: Node) => {
    const { nodes, edges, setNodes, setEdges } = store.getState()
    const newNodes = produce(nodes, (draft) => {
      draft.forEach((item) => {
        item.data._isHover = false
      })
    })
    setNodes(newNodes)
    // 节点两边的边
    const newEdges = produce(edges, (draft) => {
      draft.forEach((item) => {
        item.data._isHoverNode = false
      })
    })
    setEdges(newEdges)
  }
  // 点击节点
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    console.log('🚀 ~ handleNodeClick ~ node:', node)
    const { nodes, edges, setNodes, setEdges } = store.getState()
    const newNodes = produce(nodes, (draft) => {
      draft.forEach((item) => {
        item.data._isActive = item.id === node.id
      })
    })
    setNodes(newNodes)
    // set_panel_show(true)
  }
  return {
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    handleNodeEnter,
    handleNodeLeave,
    handleNodeClick,
  }
}
