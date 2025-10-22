'use client'

// 点击节点菜单时的候选节点

import { useReactFlow, useStoreApi, useViewport } from '@xyflow/react'
import { produce } from 'immer'
import { useEventListener } from 'ahooks'
import { v4 as uuidv4 } from 'uuid'

import { useWorkflowStore } from '../store/index'

import { nodeTypes } from './index'

export default function CandidateNode({
  mousePosition = {},
  type = 'Start',
  custom_props = { data: { type: 'Start' } },
}) {
  const store = useStoreApi()
  const reactflow = useReactFlow()
  const set_candidate_node_show = useWorkflowStore((state) => state.set_candidate_node_show)
  useEventListener('click', (e) => {
    e.preventDefault()
    const { getState } = store
    const { nodes, edges } = getState()
    const { screenToFlowPosition } = reactflow
    const { x, y } = screenToFlowPosition({ x: mousePosition.pageX, y: mousePosition.pageY })
    const newNodes = produce(nodes, (draft) => {
      draft.push({
        id: uuidv4(),
        type: 'Start',
        data: {
          title: '开始',
          type: 'start',
          _isHover: false,
          _isActive: false,
        },
        position: {
          x,
          y,
        },
      })
    })
    setNodes(newNodes)
    // set_candidate_node_show(false)
  })

  // 候选节点点击鼠标右键取消添加
  useEventListener('contextmenu', (e) => {
    e.preventDefault()
    set_candidate_node_show(false)
  })

  const { zoom } = useViewport()
  const CustomNode = nodeTypes[type] || null
  return (
    <div
      className="absolute z-10"
      style={{
        left: mousePosition.elementX,
        top: mousePosition.elementY,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <CustomNode {...(custom_props as any)} />
    </div>
  )
}
