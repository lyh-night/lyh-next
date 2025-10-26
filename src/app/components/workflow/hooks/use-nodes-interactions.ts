// 编排节点相关事件
import React from 'react'
import type { Node } from '../types'

import { useWorkflowStore } from '../store/index'

export function useNodesInteractions() {
  const set_hover_node = useWorkflowStore((state) => state.set_hover_node)
  const set_active_node = useWorkflowStore((state) => state.set_active_node)
  // 移动节点
  const handleNodeDragStart = (event: React.MouseEvent, node: Node) => {}
  const handleNodeDrag = (event: React.MouseEvent, node: Node) => {}
  const handleNodeDragStop = (event: React.MouseEvent, node: Node) => {}
  // 悬浮节点
  const handleNodeEnter = (event: React.MouseEvent, node: Node) => {
    set_hover_node(node.id)
  }
  const handleNodeLeave = (event: React.MouseEvent, node: Node) => {
    set_hover_node('')
  }
  // 点击节点
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    set_active_node(node.id)
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
