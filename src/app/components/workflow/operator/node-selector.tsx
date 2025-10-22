'use client'

import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { RiAddCircleFill, RiHome4Fill } from '@remixicon/react'
import { node_type_list, node_type_desc_obj } from '../config'

import Tooltip from '@/components/tooltip'

import Baseicon from '../BaseIcon'

export function NodeSelectorItem({ data, edge_id, onSelect }) {
  function handleAddNode() {
    console.log(data, edge_id, '点击')
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
        onClick={() => onSelect(data.value)}
        className="box-border flex w-[180px] cursor-pointer items-center rounded-[4px] px-[10px] text-left leading-[30px] text-[#354052] hover:bg-[#f4f5f7]"
      >
        <Baseicon name={data.value} size={20} className="mr-[8px]" />
        {data.label}
      </div>
    </Tooltip>
  )
}

export function NodeSelectorList({ edge_id, onSelect }: { edge_id?: string }) {
  return (
    <div className="h-[400px] overflow-auto" onClick={(e) => e.stopPropagation()}>
      {node_type_list.map((i) => {
        if (i.children) {
          return (
            <div key={i.value}>
              <div className="px-[10px] text-[12px] text-[#676f83]">{i.label}</div>
              {i.children.map((j) => (
                <NodeSelectorItem key={j.value} data={j} edge_id={edge_id} onSelect={onSelect} />
              ))}
            </div>
          )
        } else {
          return <NodeSelectorItem key={i.value} data={i} edge_id={edge_id} onSelect={onSelect} />
        }
      })}
    </div>
  )
}

export function NodeSelector({ edge_id }: { edge_id: string }) {
  return (
    <Popover className="flex shadow-xl">
      <PopoverButton className="relative focus:outline-none">
        <RiAddCircleFill className="h-[16px] w-[16px] cursor-pointer rounded-[50%] bg-white text-[#3c6cf6]" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="right"
        className="z-[11] box-border rounded-[2px] bg-white p-[6px] shadow-xl transition duration-200 ease-in-out [--anchor-gap:--spacing(5)] data-closed:-translate-y-1 data-closed:opacity-0"
      >
        <NodeSelectorList edge_id={edge_id} />
      </PopoverPanel>
    </Popover>
  )
}
