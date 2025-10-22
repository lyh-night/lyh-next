// 编排 ts
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from '@xyflow/react'

export type CommonNodeType<T = object> = {
  _isHover?: boolean
  _isActive?: boolean
  title?: string
  type: string
  desc?: string
  width?: number
  height?: number
} & T

export type Node<T = object> = ReactFlowNode<CommonNodeType<T>>
export type NodeProps<T = object> = { id: string; data: CommonNodeType<T> }

export type CommonEdgeType = {
  _isHoverNode?: boolean
  _isHover?: boolean
}

export type Edge = ReactFlowEdge<CommonEdgeType>
