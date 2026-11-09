import type { Request } from 'express'

/** 用户档案（数据库最新状态）：/me、登录响应、JWT 签发入参 */
export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
  hasAccess: boolean
  role: string
}

/** JWT claims（签发与校验共用） */
export interface AuthTokenPayload {
  sub: string
  email: string
  role: string
  hasAccess: boolean
}

/** 守卫写入 `request.user` 的最小身份信息 */
export interface AuthUserPayload {
  id: string
  email: string
  role: string
  hasAccess: boolean
}

/** 附带用户身份的请求对象 */
export interface AuthRequest extends Request {
  user?: AuthUserPayload
}
