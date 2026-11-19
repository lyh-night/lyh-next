import type { SseFrame } from '@/utils/sse'

/** 上游 OpenAI 兼容 chunk（只取本端用到的字段） */
interface UpstreamChunk {
  choices?: Array<{ delta?: { content?: string } }>
}

/** 后端在流内注入的错误帧：`{ error: { message, type: 'backend_stream_error' } }` */
interface UpstreamErrorFrame {
  error?: { message?: string; type?: string }
}

/** 一帧 SSE 的对话语义 */
export type ChatStreamEvent =
  { type: 'done' } | { type: 'delta'; text: string } | { type: 'error'; message: string }

/**
 * 把 SSE 帧解析为对话协议事件。
 *
 * 保持宽容策略：空帧、非 JSON 帧、无关字段帧返回 null，单帧异常不中断整条流；
 * `[DONE]` 结束哨兵与流内错误帧在这里归一，传输层只负责派发。
 */
export function parseChatStreamFrame(frame: SseFrame): ChatStreamEvent | null {
  const data = frame.data
  if (!data) return null
  if (data === '[DONE]') return { type: 'done' }

  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    // 非 JSON 帧（例如平台自定义事件）直接忽略
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const payload = parsed as UpstreamChunk & UpstreamErrorFrame
  if (payload.error?.type === 'backend_stream_error') {
    return { type: 'error', message: payload.error.message || 'AI 流已中断' }
  }

  const text = payload.choices?.[0]?.delta?.content
  return text ? { type: 'delta', text } : null
}
