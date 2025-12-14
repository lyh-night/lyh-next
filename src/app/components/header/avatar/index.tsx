'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
        {/* <span className="hidden text-sm text-gray-700 md:inline">{displayName}</span> */}
        <div className="group relative">
          <div className="h-[36px] w-[36px] cursor-pointer rounded-[50%] bg-[#2d5de6] text-center leading-[36px] font-medium text-white">
            {firstLetter}
          </div>
          <div className="absolute top-full right-0 hidden w-[100px] pt-1 group-hover:block hover:block">
            <div className="ring-opacity-5 rounded-md bg-white p-[10px] shadow-lg ring-1 ring-black">
              <button
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="block w-full cursor-pointer px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-100"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
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
