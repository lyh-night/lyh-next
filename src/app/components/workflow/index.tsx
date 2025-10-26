'use client'

import { useState, useEffect, useRef } from 'react'
import { ReactFlow, Background, MiniMap, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useEventListener } from 'ahooks'
import { useWorkflowStore } from './store/index'
import { useNodesInteractions, useEdgesInteractions } from './hooks/index'
import { nodeTypes } from './nodes/index'
import { edgeTypes } from './edge/index'
import WorkflowOperation from './operator/workflow-operation'
import ZoomInOut from './operator/zoom-in-out'
import Control from './operator/control'
import CandidateNode from './nodes/CandidateNode'
import { Panel } from './panel'
import type { Node, Edge } from './types'

function Workflow() {
  const nodes: Node[] = useWorkflowStore((state) => state.nodes)
  const edges: Edge[] = useWorkflowStore((state) => state.edges)

  const {
    handleNodeEnter,
    handleNodeLeave,
    handleNodeClick,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    handleNodesChange,
    handleEdgesChange,
  } = useNodesInteractions()
  const { handleEdgeEnter, handleEdgeLeave } = useEdgesInteractions()

  const candidate_node_show = useWorkflowStore((state) => state.candidate_node_show)
  const active_node = useWorkflowStore((state) => state.active_node)
  const set_mouse_position = useWorkflowStore((state) => state.set_mouse_position)

  const workflowContainerRef = useRef<HTMLDivElement>(null)
  // 处理添加候选节点跟随鼠标移动
  useEventListener('mousemove', (e) => {
    const containerClientRect = workflowContainerRef.current?.getBoundingClientRect()
    if (containerClientRect) {
      set_mouse_position({
        pageX: e.clientX,
        pageY: e.clientY,
        elementX: e.clientX - containerClientRect.left,
        elementY: e.clientY - containerClientRect.top,
      })
    }
  })

  return (
    <div className="relative h-full w-full" ref={workflowContainerRef}>
      {/* 候选节点 */}
      {candidate_node_show && <CandidateNode />}
      {/* 修改节点的面板 */}
      {active_node && (
        <div className="absolute top-[56px] right-0 bottom-[4px] z-12">
          <Panel />
        </div>
      )}
      {/* 左边操作侧边栏 */}
      <div className="absolute top-0 left-0 z-10 flex h-full w-12 items-center justify-center p-1 pl-2">
        <Control />
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
        onEdgeMouseEnter={handleEdgeEnter}
        onEdgeMouseLeave={handleEdgeLeave}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
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

const initialNodes = [
  {
    id: 'start',
    position: { x: 0, y: 100 },
    data: { title: '开始', type: 'start' },
    type: 'start',
  },
  {
    id: 'center',
    position: { x: 300, y: 100 },
    data: { title: 'LLM', type: 'llm' },
    type: 'llm',
  },
  {
    id: 'end',
    position: { x: 600, y: 100 },
    data: { title: '结束', type: 'end' },
    type: 'end',
  },
]

const initialEdges = [
  { id: 'n1-n2', source: 'start', target: 'center', type: 'CustomEdge', data: {} },
  { id: 'n1-n3', source: 'center', target: 'end', type: 'CustomEdge', data: {} },
]

export default function WorkflowWithDefaultContext() {
  const setNodes = useWorkflowStore((state) => state.setNodes)
  const setEdges = useWorkflowStore((state) => state.setEdges)
  setNodes(initialNodes)
  setEdges(initialEdges)
  return (
    <ReactFlowProvider>
      <Workflow />
    </ReactFlowProvider>
  )
}
