'use client'

import { Button } from '@/components/shadcn/button'
import { RiArrowDownSLine } from '@remixicon/react'

export default function Operator() {
  return (
    <div className="flex h-full w-full items-center justify-between bg-transparent pr-[10px] pl-[10px]">
      <div className="text-text-tertiary text-[12px]">自动保存 10:28:16 · 未发布</div>
      <div className="flex gap-[10px]">
        <Button className="bg-primary flex h-[32px] cursor-pointer items-center rounded-[8px] px-3 py-1.5 text-center leading-none text-white">
          发布
          <RiArrowDownSLine className="ml-0.5 h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
