'use client'

import { Button } from '@headlessui/react'
import { RiArrowDownSLine } from '@remixicon/react'

export default function Operator() {
  return (
    <div className="flex h-full w-full items-center justify-between bg-transparent pr-[10px] pl-[10px]">
      <div className="text-[12px] text-[#676f83]">自动保存 10:28:16 · 未发布</div>
      <div className="flex gap-[10px]">
        {/* <Button className="h-[32px] cursor-pointer rounded border-[0.5px] px-3 py-1.5 leading-none data-hover:bg-[#f9fafb]">
          功能
        </Button> */}
        <Button className="flex h-[32px] cursor-pointer items-center rounded-[8px] bg-[#2b59e6] px-3 py-1.5 text-center leading-none text-white data-hover:bg-[#1d49e1]">
          发布
          <RiArrowDownSLine className="ml-0.5 h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
