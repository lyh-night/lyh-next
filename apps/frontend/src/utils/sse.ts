import { EventSourceParserStream } from 'eventsource-parser/stream'

/** 一条已完整解码的 SSE 帧（`: ping` 注释帧不产生帧） */
export interface SseFrame {
  /** 事件名（当前后端只发 data 帧，保留 SSE 协议字段） */
  event?: string
  data: string
}

/**
 * 把 `text/event-stream` 响应体解码为完整帧。
 *
 * - 分帧交给 eventsource-parser：多行 `data:` 合并、注释帧跳过、未闭合尾部不当作事件；
 * - 只做分帧，不做 JSON 解析或业务判断（协议语义由调用方负责）；
 * - `signal` 中止或调用方提前退出时取消底层流，避免响应体继续占用。
 */
export async function* decodeSseFrames(
  body: ReadableStream<BufferSource>,
  signal?: AbortSignal,
): AsyncGenerator<SseFrame> {
  const frames = body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
  const reader = frames.getReader()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || signal?.aborted) return
      yield { event: value.event, data: value.data }
    }
  } finally {
    void reader.cancel().catch(() => undefined)
  }
}
