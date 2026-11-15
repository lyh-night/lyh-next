import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * 请求上下文：以 AsyncLocalStorage 串联一次请求内的所有日志，
 * 解决「并发请求无法按 requestId 串联日志」的排障问题。
 */
export interface RequestContext {
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

/**
 * Express 中间件：读取或生成 X-Request-Id（上游网关已带则透传），
 * 写回响应头并存入 AsyncLocalStorage，供拦截器 / 过滤器读取。
 */
export function requestContextMiddleware(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const header = request.headers['x-request-id']
    const requestId =
      typeof header === 'string' && header.trim() ? header.trim().slice(0, 64) : randomUUID()

    response.setHeader('X-Request-Id', requestId)
    storage.run({ requestId }, () => next())
  }
}

/** 当前请求的 requestId（不在请求上下文内返回 undefined） */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId
}
