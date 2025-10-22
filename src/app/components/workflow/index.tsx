'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useEventListener } from 'ahooks'

import { useWorkflowStore } from './store/index'

import { useNodesInteractions, useEdgesInteractions } from './hooks/index'

import WorkflowOperation from './operator/workflow-operation'
import ZoomInOut from './operator/zoom-in-out'
import Control from './operator/control'

import { nodeTypes } from './nodes/index'
import { edgeTypes } from './edge/index'

import CandidateNode from './nodes/CandidateNode'

import { Panel } from './panel'

import type { Node, Edge } from './types'
import '@xyflow/react/dist/style.css'

function Workflow({
  nodes: originalNodes,
  edges: originalEdges,
}: {
  nodes: Node[]
  edges: Edge[]
}) {
  const [panelShow, setPanelShow] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState(originalNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(originalEdges)
  const { handleNodeEnter, handleNodeLeave, handleNodeClick } = useNodesInteractions()
  const { handleEdgeEnter, handleEdgeLeave } = useEdgesInteractions()

  // const [candidate_node_show, set_candidate_node_show] = useState(false)
  const [candidate_node_type, set_candidate_node_type] = useState('')
  const candidate_node_show = useWorkflowStore((state) => state.candidate_node_show)
  const set_candidate_node_show = useWorkflowStore((state) => state.set_candidate_node_show)
  const panel_show = useWorkflowStore((state) => state.panel_show)
  const [mousePosition, setMousePosition] = useState({})
  // 处理添加节点
  function handleSelect(val: string) {
    console.log(val, 'dianji1')
    set_candidate_node_type(val)
    set_candidate_node_show(true)
  }

  const workflowContainerRef = useRef<HTMLDivElement>(null)
  // 处理添加候选节点跟随鼠标移动
  // useEventListener('mousemove', (e) => {
  //   const containerClientRect = workflowContainerRef.current?.getBoundingClientRect()
  //   if (containerClientRect) {
  //     setMousePosition({
  //       pageX: e.clientX,
  //       pageY: e.clientY,
  //       elementX: e.clientX - containerClientRect.left,
  //       elementY: e.clientY - containerClientRect.top,
  //     })
  //   }
  // })

  return (
    <div className="relative h-full w-full" ref={workflowContainerRef}>
      {/* 候选节点 */}
      {/* {candidate_node_show && <CandidateNode mousePosition={mousePosition} />} */}
      {/* 修改节点的面板 */}
      {/* {panel_show && (
        <div className="absolute top-[56px] right-0 bottom-[4px] z-12">
          <Panel />
        </div>
      )} */}
      <div className="absolute top-0 left-0 z-10 flex h-full w-12 items-center justify-center p-1 pl-2">
        <Control onSelect={handleSelect} />
      </div>
      <div className="absolute top-0 left-0 z-[10] h-[56px] w-full">
        <WorkflowOperation />
      </div>
      <div className="absolute right-[10px] bottom-[6px] z-[10]">
        <ZoomInOut />
      </div>
      <MiniMap
        pannable
        zoomable
        maskColor="#e9ebf0"
        nodeColor={'#e2e2e2'}
        bgColor="#fff"
        style={{
          width: 102,
          height: 72,
        }}
        className="!absolute !right-[10px] !bottom-[50px] z-[9] !m-0 !rounded-lg !border-[0.5px] border-none !shadow-md"
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        onNodeMouseEnter={handleNodeEnter}
        onNodeMouseLeave={handleNodeLeave}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeMouseEnter={handleEdgeEnter}
        onEdgeMouseLeave={handleEdgeLeave}
      >
        <Background
          gap={[14, 14]}
          size={2}
          className="!bg-[#f2f4f7]"
          color="rgb(133 133 173 / 0.15)"
        />
      </ReactFlow>
    </div>
  )
}

const base_data = {
  _isHover: false,
  _isActive: false,
}

const initialNodes = [
  {
    id: 'start',
    position: { x: 0, y: 100 },
    data: { title: '开始', type: 'start', ...base_data },
    type: 'Start',
  },
  {
    id: 'center',
    position: { x: 300, y: 100 },
    data: { title: 'LLM', type: 'llm', ...base_data },
    type: 'Llm',
  },
  {
    id: 'end',
    position: { x: 600, y: 100 },
    data: { title: '结束', type: 'end', ...base_data },
    type: 'End',
  },
]

const edge_base = {
  _isHoverNode: false,
  _isHover: false,
}

const initialEdges = [
  { id: 'n1-n2', source: 'start', target: 'center', type: 'CustomEdge', data: { ...edge_base } },
  { id: 'n1-n3', source: 'center', target: 'end', type: 'CustomEdge', data: { ...edge_base } },
]

export default function WorkflowWithDefaultContext() {
  const [nodes] = useState(initialNodes)
  const [edges] = useState(initialEdges)
  return (
    <ReactFlowProvider>
      <Workflow nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  )
}
