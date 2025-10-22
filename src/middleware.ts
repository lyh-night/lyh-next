import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // 访问 `/` 时自动重定向到 `/home`
  if (pathname === '/' || pathname === '') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next() // 允许其他请求继续
}

// 匹配所有页面请求，排除静态文件、Next 内部资源、公开 API
export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
    },
  ],
}
