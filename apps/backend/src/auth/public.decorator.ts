import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/** 标记无需登录即可访问的路由（默认全局守卫会拦截未登录请求） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
