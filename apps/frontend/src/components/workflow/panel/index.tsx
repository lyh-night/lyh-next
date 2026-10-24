'use client'

import { RiBookOpenLine, RiCrosshairLine, RiMoreFill, RiCloseLine } from '@remixicon/react'

import Baseicon from '../BaseIcon'
import { useWorkflowStore } from '../store/index'
import { PanelContent } from './panel-content'

export function Panel() {
  const nodes = useWorkflowStore((state) => state.nodes)
  const active_node = useWorkflowStore((state) => state.active_node)
  const set_active_node = useWorkflowStore((state) => state.set_active_node)
  const current_node = nodes.find((item) => item.id == active_node)

  return (
    <div className="mr-[4px] flex h-full w-[400px] flex-col overflow-hidden rounded-[16px] bg-white">
      <div className="box-border flex shrink-0 justify-between px-[10px] py-[20px]">
        <Baseicon name={current_node?.data?.type || ''} size={26} className="mr-[10px]"></Baseicon>
        <div className="flex shrink grow items-center">{current_node?.data?.title}</div>
        <div className="text-text-tertiary flex items-center">
          <button
            type="button"
            aria-label="定位节点"
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]"
          >
            <RiCrosshairLine className="text-text-tertiary h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="查看文档"
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]"
          >
            <RiBookOpenLine className="text-text-tertiary h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="更多选项"
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]"
          >
            <RiMoreFill className="text-text-tertiary h-4 w-4" />
          </button>
          <div className="bg-divider mx-[12px] h-[14px] w-[1px]"></div>
          <button
            type="button"
            aria-label="关闭面板"
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px]"
            onClick={() => set_active_node('')}
          >
            <RiCloseLine className="text-text-tertiary h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelContent />
      </div>
    </div>
  )
}
