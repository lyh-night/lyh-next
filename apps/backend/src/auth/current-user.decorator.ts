import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common'
import { ApiCode } from '../common/errors/api-code.js'
import { ApiException } from '../common/errors/api.exception.js'
import type { AuthRequest, AuthUserPayload } from './auth.types.js'

/**
 * 从请求上取守卫写入的 `request.user`；全局守卫保证已登录，
 * 缺失视为会话失效（兜底，防止在 `@Public()` 路由上误用）。
 * 传字段名只取该字段：`@CurrentUser('id')`；不传返回整个 payload。
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>()
    if (!request.user) {
      throw new ApiException(ApiCode.UNAUTHORIZED, '未登录或登录已过期', HttpStatus.UNAUTHORIZED)
    }
    return field ? request.user[field] : request.user
  },
)
