import { createStore, useStore } from 'zustand'

export type workflowStoreShape = {
  candidate_node_show: boolean
  set_candidate_node_show: (candidate_node_show: boolean) => void
  panel_show: boolean
  set_panel_show: (set_panel_show: boolean) => void
  cur_select_node_id: string
  set_cur_select_node_id: (cur_select_node_id: string) => void
}

export const workflowStore = createStore<workflowStoreShape>((set, get) => ({
  candidate_node_show: false,
  set_candidate_node_show: (candidate_node_show) => set({ candidate_node_show }),
  panel_show: false,
  set_panel_show: (panel_show) => set({ panel_show }),
  cur_select_node_id: '',
  set_cur_select_node_id: (cur_select_node_id) => set({ cur_select_node_id }),
}))

export function useWorkflowStore<T>(selector: (state: workflowStoreShape) => T): T {
  return useStore(workflowStore, selector)
}
