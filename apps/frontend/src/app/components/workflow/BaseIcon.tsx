'use client'

import Image from 'next/image'
import React from 'react'

import { node_icon_bgc_enum } from './config'

export interface IconSwitcherProps {
  name: string
  size?: number
  backgroundColor?: string // 镂空部分想要的底色
  className?: string
}

/**
 * 按 key 显示 public/icons 下的 SVG 文件
 */
export default function IconSwitcher({
  name,
  size = 24,
  backgroundColor,
  className = '',
}: IconSwitcherProps) {
  const src = `/icon/workflow/${name}.svg`

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[8px] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: backgroundColor || node_icon_bgc_enum[name] || '#e99537', // 镂空区域的底色
      }}
    >
      <Image src={src} alt={name} width={14} height={14} />
    </span>
  )
}
