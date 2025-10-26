// 编排 ts
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from '@xyflow/react'

export type CommonNodeType<T = object> = {
  title?: string
  type: string
  desc?: string
  width?: number
  height?: number
  _isCandidateNode?: boolean
} & T

export type Node<T = object> = ReactFlowNode<CommonNodeType<T>>
export type NodeProps<T = object> = { id: string; data: CommonNodeType<T> }

export type Edge = ReactFlowEdge
