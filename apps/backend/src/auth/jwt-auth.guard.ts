import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from './public.decorator.js'
import { TokenService } from './token.service.js'

export interface AuthUserPayload {
  id: string
  email: string
  role: string
  hasAccess: boolean
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload
}

/**
 * 全局登录守卫：
 * - 默认所有路由都需要登录；
 * - `@Public()` 放行；
 * - 开发环境下 Swagger 文档放行（生产仍需登录）。
 *
 * 凭据优先取 `Authorization: Bearer`，其次取 httpOnly cookie（浏览器场景）。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly cookieName: string
  private readonly isProduction: boolean

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>('AUTH_COOKIE_NAME') ?? 'auth_token'
    this.isProduction = config.get<string>('NODE_ENV') === 'production'
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>()

    if (this.isPublicRoute(context, request)) return true

    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('未登录或登录已过期')

    const payload = await this.tokenService.verify(token)
    if (!payload) throw new UnauthorizedException('未登录或登录已过期')

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      hasAccess: payload.hasAccess,
    }

    return true
  }

  private isPublicRoute(context: ExecutionContext, request: AuthRequest): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    // Swagger UI 及其静态资源：开发环境放行，生产需要登录
    const path = request.path ?? ''
    return !this.isProduction && path.startsWith('/api/docs')
  }

  private extractToken(request: AuthRequest): string | undefined {
    const header = request.headers.authorization
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim()
    }

    return request.cookies?.[this.cookieName] as string | undefined
  }
}
