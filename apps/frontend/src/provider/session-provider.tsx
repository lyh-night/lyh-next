'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiUrl } from '@/utils/api'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
  hasAccess: boolean
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface SessionContextValue {
  user: SessionUser | null
  status: SessionStatus
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

// 登录/注册页不触发跳转，避免循环
const PUBLIC_PATHS = ['/auth/login', '/auth/register']

/**
 * 会话上下文：认证完全由后端负责（httpOnly cookie），
 * 这里只把 GET /api/auth/me 的结果放进 React state，不做任何 token 处理。
 */
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')
  // 记录"会话检查已针对哪个路由完成"：避免刚登录跳转时用上一个页面的 unauthenticated 状态把人弹回登录页
  const [checkedPath, setCheckedPath] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        setUser(null)
        setStatus('unauthenticated')
        return
      }

      const data = (await response.json()) as { user: SessionUser }
      setUser(data.user)
      setStatus('authenticated')
    } catch {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  // 路由变化时同步会话：登录跳转、退出登录后都能立刻反映到界面
  useEffect(() => {
    let cancelled = false
    void refresh().finally(() => {
      if (!cancelled) setCheckedPath(pathname)
    })

    return () => {
      cancelled = true
    }
  }, [pathname, refresh])

  // cookie 过期或失效时（/me 返回 401），把用户送回登录页
  useEffect(() => {
    // 只对"当前路由的检查结果"生效，避免沿用上一个页面的状态
    if (checkedPath !== pathname) return
    if (status !== 'unauthenticated') return
    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return

    router.replace(`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`)
  }, [checkedPath, status, pathname, router])

  const logout = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    } catch {
      // 即使请求失败也清掉本地状态，避免界面卡在"已登录"
    }

    setUser(null)
    setStatus('unauthenticated')
    router.replace('/auth/login')
  }, [router])

  const value = useMemo<SessionContextValue>(
    () => ({ user, status, refresh, logout }),
    [user, status, refresh, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** 兼容原有调用形状：{ data, status } + logout/refresh */
export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession 必须在 SessionProvider 内使用')

  return {
    data: context.user ? { user: context.user } : null,
    status: context.status,
    refresh: context.refresh,
    logout: context.logout,
  }
}
