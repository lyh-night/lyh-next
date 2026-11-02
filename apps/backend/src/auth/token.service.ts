import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SignJWT, jwtVerify } from 'jose'
import type { AuthUser } from './auth.service.js'

export interface AuthTokenPayload {
  sub: string
  email: string
  role: string
  hasAccess: boolean
}

const ALGORITHM = 'HS256'
const DEFAULT_TTL = '7d'

/** 把 `7d` / `12h` / `3600` 解析成秒，用于 cookie 的 maxAge */
export function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim())
  if (!match) return 7 * 24 * 60 * 60

  const value = Number(match[1])
  const factors: Record<string, number> = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 }
  const factor = factors[match[2] ?? 's'] ?? 1

  return value * factor
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name)
  private readonly secret: Uint8Array
  private readonly ttl: string

  constructor(config: ConfigService) {
    const secret = config.get<string>('AUTH_SECRET')

    if (!secret) {
      // 启动即失败：没有密钥时绝不能让服务带着"可伪造的会话"跑起来
      throw new Error('缺少 AUTH_SECRET 环境变量，请在 apps/backend/.env 中配置')
    }

    this.secret = new TextEncoder().encode(secret)
    this.ttl = config.get<string>('AUTH_TOKEN_TTL') ?? DEFAULT_TTL
    this.logger.log(`会话 token 有效期：${this.ttl}`)
  }

  get ttlSeconds(): number {
    return parseTtlSeconds(this.ttl)
  }

  async sign(user: AuthUser): Promise<string> {
    return new SignJWT({
      email: user.email,
      role: user.role,
      hasAccess: user.hasAccess,
    })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(this.ttl)
      .sign(this.secret)
  }

  async verify(token: string): Promise<AuthTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: [ALGORITHM] })
      if (!payload.sub) return null

      return {
        sub: payload.sub,
        email: String(payload.email ?? ''),
        role: String(payload.role ?? 'USER'),
        hasAccess: Boolean(payload.hasAccess),
      }
    } catch {
      return null
    }
  }
}
