import type { Response } from 'express'

/** SSE 响应头（`X-Accel-Buffering` 用于关闭 nginx 缓冲） */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

/** 心跳间隔：防代理因空闲断开 */
export const SSE_KEEPALIVE_INTERVAL_MS = 15_000

/** 写一个 `data: <json>` 帧（本端生成的帧，上游帧一律原样透传） */
export function writeSseData(res: Response, payload: unknown): void {
  if (res.writableEnded || res.destroyed) return
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

/** 启动心跳注释帧，返回停止函数（必须在 finally 里调用，否则定时器泄漏） */
export function startKeepAlive(res: Response, intervalMs = SSE_KEEPALIVE_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    if (res.writableEnded || res.destroyed) return
    res.write(': ping\n\n')
  }, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
