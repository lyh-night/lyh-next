import { createStore, useStore } from 'zustand'

import type { Node, Edge } from '../types'

export type workflowStoreShape = {
  nodes: Node[]
  setNodes: (nodes: Node[]) => void
  edges: Edge[]
  setEdges: (edges: Edge[]) => void
  hover_node: string
  set_hover_node: (hover_node: string) => void
  active_node: string
  set_active_node: (active_node: string) => void
  hover_edge: string
  set_hover_edge: (hover_edge: string) => void
  candidate_node_show: boolean
  set_candidate_node_show: (candidate_node_show: boolean) => void
  mouse_position: {
    pageX: number
    pageY: number
    elementX: number
    elementY: number
  }
  set_mouse_position: (mouse_position: {
    pageX: number
    pageY: number
    elementX: number
    elementY: number
  }) => void
  candidate_node_type: string
  set_candidate_node_type: (candidate_node_type: string) => void
}

export const workflowStore = createStore<workflowStoreShape>((set, get) => ({
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  edges: [],
  setEdges: (edges) => set({ edges }),
  hover_node: '',
  set_hover_node: (hover_node) => set({ hover_node }),
  active_node: '',
  set_active_node: (active_node) => set({ active_node }),
  hover_edge: '',
  set_hover_edge: (hover_edge) => set({ hover_edge }),
  candidate_node_show: false,
  set_candidate_node_show: (candidate_node_show) => set({ candidate_node_show }),
  mouse_position: {
    pageX: 0,
    pageY: 0,
    elementX: 0,
    elementY: 0,
  },
  set_mouse_position: (mouse_position) => set({ mouse_position }),
  candidate_node_type: '',
  set_candidate_node_type: (candidate_node_type) => set({ candidate_node_type }),
}))

export function useWorkflowStore<T>(selector: (state: workflowStoreShape) => T): T {
  return useStore(workflowStore, selector)
}
