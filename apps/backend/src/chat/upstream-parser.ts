/**
 * 上游 SSE 解析器：只为「累积助手回复 / 用量」服务。
 *
 * 注意：真正发给客户端的是 `res.write(chunk)` 的**原始字节**，
 * 这里的解析不会改变协议格式（`data: [DONE]`、注释帧、字段顺序都保持上游原样）。
 */

export interface ParsedUsage {
  prompt_tokens?: number
  completion_tokens?: number
}

export interface ParsedEvent {
  /** 收到 `data: [DONE]` */
  done?: boolean
  /** 增量文本（choices[0].delta.content） */
  content?: string
  /** 结束原因（choices[0].finish_reason），通常只在最后一帧出现 */
  finishReason?: string | null
  /** 用量（部分平台需要 stream_options.include_usage 才返回） */
  usage?: ParsedUsage
}

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string | null }
    finish_reason?: string | null
  }>
  usage?: ParsedUsage | null
}

function parseEvent(raw: string): ParsedEvent | null {
  const data = raw
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n')
    .trim()

  if (!data) return null
  if (data === '[DONE]') return { done: true }

  try {
    const chunk = JSON.parse(data) as OpenAIChunk
    const choice = chunk.choices?.[0]
    return {
      content: choice?.delta?.content ?? undefined,
      finishReason: choice?.finish_reason ?? undefined,
      usage: chunk.usage ?? undefined,
    }
  } catch {
    // 非 JSON 帧（例如平台自定义事件）只透传，不参与累积
    return null
  }
}

export interface UpstreamParser {
  /** 喂入一块字节，返回其中已完整的事件（按 `\n\n` 分帧） */
  push(chunk: Uint8Array): ParsedEvent[]
}

export function createUpstreamParser(): UpstreamParser {
  const decoder = new TextDecoder()
  let buffer = ''

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n')
      const events: ParsedEvent[] = []

      let index = buffer.indexOf('\n\n')
      while (index >= 0) {
        const parsed = parseEvent(buffer.slice(0, index))
        if (parsed) events.push(parsed)
        buffer = buffer.slice(index + 2)
        index = buffer.indexOf('\n\n')
      }

      return events
    },
  }
}
