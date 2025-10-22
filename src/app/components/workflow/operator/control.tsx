'use client'

import { useRef } from 'react'

import {
  RiAddCircleFill,
  RiAspectRatioLine,
  RiCursorLine,
  RiFunctionAddLine,
  RiHand,
  RiStickyNoteAddLine,
} from '@remixicon/react'

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { NodeSelectorList } from './node-selector'
import Tooltip from '@/components/tooltip'

import { cn } from '@/utils/classnames'

const operation_list = [
  { label: '添加节点', value: 'add' },
  { label: '添加注释', value: 'add_annotation' },
  { label: '指针模式', value: 'pointer_mode' },
  { label: '手模式', value: 'cursor_mode' },
  { label: '整理节点', value: 'organize_point' },
  { label: '最大化图布', value: 'max_canvas' },
]

export type PanelProps = {
  onSelect: (open: string) => void
}

export default function Control({ onSelect }: PanelProps) {
  const addRef = useRef(null)
  function handleSelect(e) {
    if (addRef.current) {
      addRef.current.click()
      onSelect(e)
    }
  }
  return (
    <div className="pointer-events-auto flex flex-col items-center rounded-lg bg-white p-0.5 shadow-lg">
      {operation_list.map((item) => {
        if (item.value == 'add') {
          return (
            <Popover key={item.value}>
              <PopoverButton
                ref={addRef}
                className={cn(
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#676f83] hover:bg-[#f3f4f7] focus:outline-none',
                )}
              >
                <Tooltip
                  key={item.value}
                  position="top"
                  popupContent={item.label}
                  needsDelay={false}
                  offset={4}
                  popupClassName="p-[4px] text-[12px]"
                >
                  <RiAddCircleFill size="16" />
                </Tooltip>
              </PopoverButton>
              <PopoverPanel
                transition
                anchor={{ gap: 4, to: 'right' }}
                className="z-[11] box-border rounded-[2px] bg-white p-[6px] shadow-xl transition duration-200 ease-in-out data-closed:-translate-y-1 data-closed:opacity-0"
              >
                <NodeSelectorList onSelect={handleSelect} />
              </PopoverPanel>
            </Popover>
          )
        } else {
          return (
            <Tooltip
              key={item.value}
              position="top"
              popupContent={item.label}
              needsDelay={false}
              offset={4}
              popupClassName="p-[4px] text-[12px]"
            >
              <div
                className={cn(
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#676f83] hover:bg-[#f3f4f7]',
                )}
              >
                {item.value == 'add_annotation' && <RiStickyNoteAddLine size="16" />}
                {item.value == 'pointer_mode' && <RiCursorLine size="16" />}
                {item.value == 'cursor_mode' && <RiHand size="16" />}
                {item.value == 'organize_point' && <RiFunctionAddLine size="16" />}
                {item.value == 'max_canvas' && <RiAspectRatioLine size="16" />}
              </div>
            </Tooltip>
          )
        }
      })}
    </div>
  )
}
