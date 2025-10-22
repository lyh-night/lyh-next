'use client'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'

import { RiMoreLine } from '@remixicon/react'

export interface NodeControlProps {
  type?: string
}

export default function NodeControl({ type }: NodeControlProps) {
  const operation_list = [
    { label: '运行此步骤', type: 'running' },
    { label: '帮助链接', type: 'running2' },
  ]

  return (
    <Popover className="flex shadow-xl">
      <PopoverButton>
        <RiMoreLine className="custom-icon" />
      </PopoverButton>
      <PopoverPanel
        transition
        anchor="bottom end"
        className="box-border rounded-[2px] bg-white p-[6px] shadow-xl transition duration-200 ease-in-out data-closed:-translate-y-1 data-closed:opacity-0"
      >
        {operation_list.map((item) => (
          <div
            key={item.type}
            className="color-[#354052] box-border w-[160px] rounded-[2px] px-[6px] leading-[30px] hover:bg-[#f4f5f7]"
          >
            {item.label}
          </div>
        ))}
        {type == 'start' && <div>123</div>}
      </PopoverPanel>
    </Popover>
  )
}
