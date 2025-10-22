'use client'

import { useStore } from '@xyflow/react'
import type { Node } from '../types'
import { RiBookOpenLine, RiCrosshairLine, RiMoreFill, RiCloseLine } from '@remixicon/react'

import Baseicon from '../BaseIcon'
import { useWorkflowStore } from '../store/index'

export function Panel() {
  // const nodes: Node[] = useNodes()
  const nodes = useStore((state) => state.nodes)
  const current_node = nodes.find((item) => item.data._isActive)
  const set_panel_show = useWorkflowStore((state) => state.set_panel_show)
  console.log(current_node, '当前节点')

  return (
    <div className="mr-[4px] h-full w-[400px] rounded-[16px] bg-white">
      <div className="box-border flex justify-between px-[10px] py-[20px]">
        <Baseicon name={current_node?.data?.type || ''} size={26} className="mr-[10px]"></Baseicon>
        <div className="flex shrink grow items-center">{current_node?.data?.title}</div>
        <div className="flex items-center text-[#676f83]">
          <div className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]">
            <RiCrosshairLine className="text-text-tertiary h-4 w-4" />
          </div>
          <div className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]">
            <RiBookOpenLine className="text-text-tertiary h-4 w-4" />
          </div>
          <div className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px] hover:bg-[#f2f3f5]">
            <RiMoreFill className="text-text-tertiary h-4 w-4" />
          </div>
          <div className="mx-[12px] h-[14px] w-[1px] bg-[#10182814]"></div>
          <div className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-[4px]">
            <RiCloseLine
              className="text-text-tertiary h-4 w-4"
              onClick={() => set_panel_show(false)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
