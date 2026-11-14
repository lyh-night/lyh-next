import { HttpException, NotFoundException } from '@nestjs/common'
import { ApiCode, HTTP_STATUS_FALLBACK, type ApiCodeValue } from './api-code.js'
import { ApiException } from './api.exception.js'

const FALLBACK_MESSAGE = '请求失败，请稍后重试'
const INTERNAL_ERROR_MESSAGE = '服务器内部错误'
const PAYLOAD_TOO_LARGE_MESSAGE = '请求体过大，请精简后重试'
const CONFLICT_MESSAGE = '数据冲突，请稍后重试'
const NOT_FOUND_MESSAGE = '资源不存在或已被删除'
const INVALID_JSON_MESSAGE = '请求体不是合法的 JSON'
const ROUTE_NOT_FOUND_MESSAGE = '接口不存在'

/** body-parser 解析失败时 V8 / Node 给出的英文文案特征 */
const INVALID_JSON_PATTERN =
  /is not valid JSON|Unexpected token|Unexpected end of JSON|JSON at position/i

/** 未知路由：Nest 抛 `NotFoundException("Cannot GET /api/...")` */
const ROUTE_NOT_FOUND_PATTERN = /^Cannot [A-Z]+ /

/**
 * 解析异常对应的业务码。
 * 顺序：显式 ApiException → HTTP 状态兜底 → 非 HttpException 自带的状态 → Prisma → 10000。
 */
export function resolveApiCode(exception: unknown): ApiCodeValue {
  if (exception instanceof ApiException) return exception.code

  if (exception instanceof HttpException) return fallbackFor(exception.getStatus())

  // 非 HttpException 但自带 HTTP 状态（例如 body-parser 的 413 PayloadTooLargeError）
  const status = readHttpStatus(exception)
  if (status !== undefined) return fallbackFor(status)

  // Prisma 已知错误：唯一约束 / 记录不存在
  const prismaCode = readPrismaCode(exception)
  if (prismaCode === 'P2002') return ApiCode.CONFLICT
  if (prismaCode === 'P2025') return ApiCode.NOT_FOUND

  return ApiCode.INTERNAL_ERROR
}

/** 解析可直接展示的失败文案（不含堆栈、SQL、密钥） */
export function resolveApiMessage(exception: unknown, code: ApiCodeValue): string {
  if (exception instanceof ApiException) {
    return exception.message.trim() || FALLBACK_MESSAGE
  }

  if (code === ApiCode.PAYLOAD_TOO_LARGE) return PAYLOAD_TOO_LARGE_MESSAGE

  if (exception instanceof HttpException) {
    const text = readHttpExceptionMessage(exception)
    if (!text) return FALLBACK_MESSAGE

    // 非法 JSON 被 Nest 转成 BadRequestException，message 是英文解析信息
    if (INVALID_JSON_PATTERN.test(text)) return INVALID_JSON_MESSAGE

    // 未知路由
    if (exception instanceof NotFoundException && ROUTE_NOT_FOUND_PATTERN.test(text)) {
      return ROUTE_NOT_FOUND_MESSAGE
    }

    return text
  }

  // 非 HttpException 的 Prisma 错误：给用户可读文案，不暴露 SQL / 约束名
  if (code === ApiCode.CONFLICT) return CONFLICT_MESSAGE
  if (code === ApiCode.NOT_FOUND) return NOT_FOUND_MESSAGE

  return INTERNAL_ERROR_MESSAGE
}

/** `stack` 只在未预期异常、且非生产环境返回 */
export function shouldIncludeStack(code: ApiCodeValue, isProduction: boolean): boolean {
  return code === ApiCode.INTERNAL_ERROR && !isProduction
}

function fallbackFor(status: number): ApiCodeValue {
  return HTTP_STATUS_FALLBACK[status] ?? ApiCode.INTERNAL_ERROR
}

function readHttpExceptionMessage(exception: HttpException): string | undefined {
  const payload = exception.getResponse()

  if (typeof payload === 'string') return payload.trim() || undefined

  if (!payload || typeof payload !== 'object') return undefined

  const raw = (payload as { message?: unknown }).message

  if (Array.isArray(raw)) {
    const text = raw.filter((item): item is string => typeof item === 'string').join('；')
    return text.trim() || undefined
  }

  if (typeof raw === 'string') return raw.trim() || undefined

  return undefined
}

function readHttpStatus(exception: unknown): number | undefined {
  if (!exception || typeof exception !== 'object') return undefined

  const record = exception as { status?: unknown; statusCode?: unknown }
  const status = typeof record.status === 'number' ? record.status : record.statusCode

  return typeof status === 'number' ? status : undefined
}

function readPrismaCode(exception: unknown): string | undefined {
  if (!exception || typeof exception !== 'object') return undefined

  const record = exception as { name?: unknown; code?: unknown }
  if (record.name !== 'PrismaClientKnownRequestError') return undefined

  return typeof record.code === 'string' ? record.code : undefined
}

function isPayloadTooLarge(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false

  const record = exception as { type?: unknown; status?: unknown; statusCode?: unknown }

  return record.type === 'entity.too.large' || record.status === 413 || record.statusCode === 413
}
