'use client'
import Image from 'next/image'

export default function Header() {
  return (
    <div className="flex-1">
      <Image src="/logo.svg" className="cursor-pointer" alt="" width="32" height="32" />
    </div>
  )
}
