import { SetMetadata } from '@nestjs/common'

export const SKIP_RESPONSE_ENVELOPE = 'skipResponseEnvelope'

/**
 * 跳过统一响应包装。
 * 用于 SSE / 文件流等自行写响应的路由。
 */
export const SkipResponseEnvelope = () => SetMetadata(SKIP_RESPONSE_ENVELOPE, true)
