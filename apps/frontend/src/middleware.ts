import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token'

// 公开路由 - 不需要认证
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/api/auth']

/**
 * 这里只做"有没有会话 cookie"的粗粒度拦截：
 * Edge 运行时的 process.env 在构建期内联，无法在这里安全地验签，
 * 真正的鉴权由后端 JwtAuthGuard 负责；cookie 过期/伪造时
 * 前端 SessionProvider 会因 /api/auth/me 返回 401 而跳回登录页。
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (!request.cookies.has(COOKIE_NAME)) {
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
