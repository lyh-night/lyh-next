'use client'

// 点击节点菜单时的候选节点

import { useReactFlow, useViewport } from '@xyflow/react'
import { produce } from 'immer'
import { useEventListener } from 'ahooks'
import { v4 as uuidv4 } from 'uuid'

import { useWorkflowStore } from '../store/index'

import { nodeTypes } from './index'
import type { NodeProps } from '../types'
import { node_type_obj } from '../config'

export default function CandidateNode() {
  const reactflow = useReactFlow()
  const nodes = useWorkflowStore((state) => state.nodes)
  const setNodes = useWorkflowStore((state) => state.setNodes)
  const candidate_node_type = useWorkflowStore((state) => state.candidate_node_type)
  const set_candidate_node_show = useWorkflowStore((state) => state.set_candidate_node_show)

  const mouse_position = useWorkflowStore((state) => state.mouse_position)

  useEventListener('click', (e) => {
    e.preventDefault()
    const { screenToFlowPosition } = reactflow
    const { x, y } = screenToFlowPosition({ x: mouse_position.pageX, y: mouse_position.pageY })
    const newNodes = produce(nodes, (draft) => {
      draft.push({
        id: uuidv4(),
        type: candidate_node_type || 'start',
        data: {
          title: node_type_obj[candidate_node_type],
          type: candidate_node_type,
        },
        position: {
          x,
          y,
        },
      })
    })
    setNodes(newNodes)
    set_candidate_node_show(false)
  })

  // 候选节点点击鼠标右键取消添加
  useEventListener('contextmenu', (e) => {
    e.preventDefault()
    set_candidate_node_show(false)
  })

  const { zoom } = useViewport()
  const CustomNode = nodeTypes[candidate_node_type] || nodeTypes.start
  const custom_props: NodeProps = {
    id: uuidv4(),
    data: {
      type: candidate_node_type,
      title: node_type_obj[candidate_node_type],
      _isCandidateNode: true,
    },
  }
  return (
    <div
      className="absolute z-10"
      style={{
        left: mouse_position.elementX,
        top: mouse_position.elementY,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <CustomNode {...custom_props} />
    </div>
  )
}
