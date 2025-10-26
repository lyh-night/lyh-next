'use client'

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { RiAddCircleFill } from '@remixicon/react'
import { useRef } from 'react'
import { node_type_list, node_type_desc_obj } from '../config'

import Tooltip from '@/components/tooltip'
import Baseicon from '../BaseIcon'
import { useWorkflowStore } from '../store/index'

export function NodeSelectorItem({ data }: { data: { label: string; value: string } }) {
  const set_candidate_node_show = useWorkflowStore((state) => state.set_candidate_node_show)
  const set_candidate_node_type = useWorkflowStore((state) => state.set_candidate_node_type)
  function handleAddNode(type: string) {
    set_candidate_node_type(type)
    set_candidate_node_show(true)
  }
  return (
    <Tooltip
      position="right"
      popupClassName="w-[200px]"
      needsDelay={false}
      popupContent={
        <div>
          <Baseicon className="mb-2" name={data.value} />
          <div className="mb-1 text-[14px]">{data.label}</div>
          <div className="text-[12px] text-[#696f81]">{node_type_desc_obj[data.value]}</div>
        </div>
      }
    >
      <div
        onClick={() => handleAddNode(data.value)}
        className="box-border flex w-[180px] cursor-pointer items-center rounded-[4px] px-[10px] text-left leading-[30px] text-[#354052] hover:bg-[#f4f5f7]"
      >
        <Baseicon name={data.value} size={20} className="mr-[8px]" />
        {data.label}
      </div>
    </Tooltip>
  )
}

export function NodeSelectorList() {
  return (
    <div className="h-[400px] overflow-auto">
      {node_type_list.map((i) => {
        if (i.children) {
          return (
            <div key={i.value}>
              <div className="px-[10px] text-[12px] text-[#676f83]">{i.label}</div>
              {i.children.map((j) => (
                <NodeSelectorItem key={j.value} data={j} />
              ))}
            </div>
          )
        } else {
          return <NodeSelectorItem key={i.value} data={i} />
        }
      })}
    </div>
  )
}

export function NodeSelector({ edge_id }: { edge_id: string }) {
  const addRef = useRef<HTMLButtonElement>(null)
  function handleClick(event: React.MouseEvent) {
    event.stopPropagation()
    if (addRef.current) {
      addRef.current.click()
    }
  }
  return (
    <Popover className="flex shadow-xl" onClick={handleClick}>
      <PopoverButton ref={addRef} className="relative focus:outline-none">
        <RiAddCircleFill className="h-[16px] w-[16px] cursor-pointer rounded-[50%] bg-white text-[#3c6cf6]" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="right"
        className="z-[11] box-border rounded-[2px] bg-white p-[6px] shadow-xl transition duration-200 ease-in-out data-closed:-translate-y-1 data-closed:opacity-0"
      >
        <NodeSelectorList />
      </PopoverPanel>
    </Popover>
  )
}
