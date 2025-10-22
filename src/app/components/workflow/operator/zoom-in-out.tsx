'use client'

import { useReactFlow, useViewport } from '@xyflow/react'

import { RiZoomInLine, RiZoomOutLine } from '@remixicon/react'

export default function ZoomInOut() {
  const { zoomIn, zoomOut } = useReactFlow()
  const { zoom } = useViewport()

  return (
    <div className="flex w-[103px] items-center justify-between rounded-[4px] bg-white px-[6px] py-[4px] hover:bg-[#e6e8ee]">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${zoom <= 0.25 ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'}`}
        onClick={(e) => {
          if (zoom <= 0.25) return
          e.stopPropagation()
          zoomOut()
        }}
      >
        <RiZoomOutLine className="h-[16px] w-[16px] text-[#676f83]" />
      </div>
      <span className="text-[12px] select-none">
        {Number.parseFloat(`${zoom * 100}`).toFixed(0)}%
      </span>
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${zoom >= 2 ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-black/5'}`}
        onClick={(e) => {
          if (zoom >= 2) return
          e.stopPropagation()
          zoomIn()
        }}
      >
        <RiZoomInLine className="h-[16px] w-[16px] text-[#676f83]" />
      </div>
    </div>
  )
}
