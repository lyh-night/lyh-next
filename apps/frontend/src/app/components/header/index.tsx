'use client'

import AppIcon from './app-icon/index'
import Nav from './nav/index'
import Avatar from './avatar/index'

export default function Header() {
  return (
    <div className="flex h-[56px] w-full items-center bg-[#f3f4f7] pl-[10px] pr-[10px]">
      <AppIcon />
      <Nav />
      <Avatar />
    </div>
  )
}
