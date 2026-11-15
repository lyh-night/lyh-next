import { EventSourceParserStream } from 'eventsource-parser/stream'
import { apiUrl, isApiEnvelope, reportApiError } from '@/utils/api'

/**
 * AI 对话的 SSE 传输层（POST + JSON + credentials）。
 *
 * 与 axios 通道的差异：
 * - 失败可能发生在响应头之前（HTTP 200 + JSON 信封），也可能发生在流中（backend_stream_error 帧）；
 * - 不做自动重连：重连会导致上游重复计费 / 消息重复落库，失败由用户手动重试；
 * - 中断通过外部 AbortController 传入，中止后静默返回（不算错误）。
 *
 * 协议：成功为 OpenAI `data: {...}` + `data: [DONE]`；心跳 `: ping` 注释帧由
 * EventSourceParserStream 消化；流内错误为 `data: {"error":{...,"type":"backend_stream_error"}}`。
 */

interface UpstreamChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
}

interface UpstreamErrorFrame {
  error?: { message?: string; type?: string }
}

export interface ChatStreamInput {
  content: string
  conversationId?: string
  modelId?: string
  signal?: AbortSignal
}

export interface ChatStreamHandlers {
  /** 响应头 X-Conversation-Id：新会话由后端自动创建后回传 */
  onConversationId: (id: string) => void
  /** 响应头 X-Message-Id：assistant 占位消息的真实 id */
  onMessageId: (id: string) => void
  /** 增量文本 */
  onDelta: (text: string) => void
  /** 流已开始后的错误（backend_stream_error 帧） */
  onStreamError: (message: string) => void
  /** 流正常结束（[DONE] 或流关闭）；幂等 */
  onDone: () => void
}

export async function postChatCompletion(
  input: ChatStreamInput,
  handlers: ChatStreamHandlers,
): Promise<void> {
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    handlers.onDone()
  }

  let response: Response
  try {
    response = await fetch(apiUrl('/api/chat/completions'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: input.content,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {}),
      }),
      signal: input.signal,
    })
  } catch (error) {
    finish()
    if (input.signal?.aborted) return
    throw reportApiError({ code: -1, message: '网络连接失败，请检查网络后重试' })
  }

  // 响应头之前失败：后端返回 HTTP 200 + 统一信封（业务码），复用 axios 通道的错误处理
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    finish()
    const body: unknown = await response.json().catch(() => null)

    if (isApiEnvelope(body)) {
      throw reportApiError({ code: body.code, message: body.message || '请求失败，请稍后重试' })
    }
    throw reportApiError({
      code: response.status,
      message: `请求失败（HTTP ${response.status}），请稍后重试`,
    })
  }

  const conversationId = response.headers.get('X-Conversation-Id')
  if (conversationId) handlers.onConversationId(conversationId)
  const messageId = response.headers.get('X-Message-Id')
  if (messageId) handlers.onMessageId(messageId)

  if (!response.body) {
    finish()
    throw reportApiError({ code: -1, message: '连接已中断，请稍后重试' })
  }

  try {
    const events = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
    const reader = events.getReader()

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (input.signal?.aborted) break

      if (value.data === '[DONE]') break
      if (!value.data) continue

      let payload: (UpstreamChunk & UpstreamErrorFrame) | null = null
      try {
        payload = JSON.parse(value.data) as UpstreamChunk & UpstreamErrorFrame
      } catch {
        // 非协议帧直接忽略，不让单帧异常中断整条流
        continue
      }
      if (!payload) continue

      if (payload.error?.type === 'backend_stream_error') {
        handlers.onStreamError(payload.error.message || 'AI 流已中断')
        break
      }

      const delta = payload.choices?.[0]?.delta?.content
      if (delta) handlers.onDelta(delta)
    }
  } catch (error) {
    // 读取中途异常：用户主动中止视为正常停止，其余交给调用方提示
    if (!input.signal?.aborted) {
      throw reportApiError({ code: -1, message: '连接中断，请稍后重试' })
    }
  } finally {
    finish()
  }
}
