// 编排节点相关事件
import React from 'react'
import type { Node, Edge, NodeChange, EdgeChange } from '../types'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

import { useWorkflowStore } from '../store/index'

export function useNodesInteractions() {
  const nodes = useWorkflowStore((state) => state.nodes)
  const setNodes = useWorkflowStore((state) => state.setNodes)
  const edges = useWorkflowStore((state) => state.edges)
  const setEdges = useWorkflowStore((state) => state.setEdges)
  const set_hover_node = useWorkflowStore((state) => state.set_hover_node)
  const set_active_node = useWorkflowStore((state) => state.set_active_node)
  // 移动节点
  const handleNodeDragStart = (event: React.MouseEvent, node: Node) => {}
  const handleNodeDrag = (event: React.MouseEvent, node: Node) => {}
  const handleNodeDragStop = (event: React.MouseEvent, node: Node) => {}
  // 拖拽
  const handleNodesChange = (changes: NodeChange[]) => {
    const newNodes = applyNodeChanges(changes, nodes)
    setNodes(newNodes)
  }
  const handleEdgesChange = (changes: EdgeChange[]) => {
    const newEdges = applyEdgeChanges(changes, edges)
    setEdges(newEdges)
  }
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
    handleNodesChange,
    handleEdgesChange,
  }
}
