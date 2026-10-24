'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@lyh-next/components'

export default function Avatar() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return (
      <div className="flex flex-1 justify-end">
        <div className="h-[36px] w-[36px] animate-pulse rounded-[50%] bg-gray-300" />
      </div>
    )
  }

  if (session?.user) {
    const user = session.user
    const displayName = user.name || user.email?.split('@')[0] || 'User'
    const firstLetter = displayName.charAt(0).toUpperCase()

    return (
      <div className="flex flex-1 items-center justify-end gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none focus:outline-none">
            <div className="h-[36px] w-[36px] cursor-pointer rounded-[50%] bg-[#2d5de6] text-center font-medium leading-[36px] text-white">
              {firstLetter}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>设置</DropdownMenuItem>
            <DropdownMenuItem>版本信息</DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/login' })}>
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-end gap-3">
      <button
        onClick={() => router.push('/auth/login')}
        className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        登录
      </button>
      <button
        onClick={() => router.push('/auth/register')}
        className="rounded-md bg-[#2d5de6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        注册
      </button>
    </div>
  )
}
