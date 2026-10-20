import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // 公开路由 - 不需要认证
  const publicPaths = ['/auth/login', '/auth/register', '/api/auth']
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

  // 如果是公开路径，允许访问
  if (isPublicPath) {
    return NextResponse.next()
  }

  // 如果没有token且不是公开路径，重定向到登录页
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 访问 `/` 时自动重定向到 `/home`
  if (pathname === '/' || pathname === '') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

// 匹配所有页面请求，排除静态文件、Next 内部资源、公开 API
export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|logo.svg|api/auth).*)',
    },
  ],
}
