import { Body, Controller, Post, Res } from '@nestjs/common'
import { ApiBody, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger'
import { once } from 'node:events'
import type { Response } from 'express'
import { ChatService } from './chat.service.js'
import { ChatCompletionDto } from './dto/chat-completion.dto.js'
import { SSE_HEADERS, startKeepAlive, writeSseData } from './sse.js'
import { createUpstreamParser, type ParsedUsage } from './upstream-parser.js'

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('completions')
  @ApiOperation({
    summary: 'AI 对话（OpenAI 协议 SSE 流式）',
    description:
      '逐帧透传上游 text/event-stream，以 data: [DONE] 结束。历史由后端维护，请求体只需传本轮 content。',
  })
  @ApiProduces('text/event-stream')
  @ApiBody({ type: ChatCompletionDto })
  @ApiOkResponse({ description: 'SSE 流；响应头含 X-Conversation-Id / X-Message-Id' })
  async completions(@Body() dto: ChatCompletionDto, @Res() res: Response): Promise<void> {
    const clientAbort = new AbortController()
    const onClose = () => clientAbort.abort()

    let conversationId: string | undefined
    let assistantMessageId: string | undefined
    let stopKeepAlive: (() => void) | undefined
    let finalized = false

    let content = ''
    let finishReason: string | null = null
    let usage: ParsedUsage | undefined
    let sawDone = false
    let aborted = false
    // 出错但还没开始流时，把响应交回全局过滤器；finally 里不能 res.end()，否则会抢先提交 201 空响应
    let delegateToFilter = false

    const finalize = async (status: 'completed' | 'aborted' | 'error', reason?: string | null) => {
      if (finalized || !assistantMessageId || !conversationId) return
      finalized = true
      await this.chatService.finalize({
        assistantMessageId,
        conversationId,
        content,
        status,
        finishReason: reason ?? finishReason,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
      })
    }

    try {
      const turn = await this.chatService.prepareTurn(dto)
      conversationId = turn.conversationId
      assistantMessageId = turn.assistantMessageId

      const upstream = await this.chatService.openUpstream(turn, clientAbort.signal)

      res.writeHead(200, {
        ...SSE_HEADERS,
        'X-Conversation-Id': conversationId,
        'X-Message-Id': assistantMessageId,
      })
      res.flushHeaders()
      res.on('close', onClose)
      stopKeepAlive = startKeepAlive(res)

      // 原始字节直接透传（保证 OpenAI 协议格式不失真），另解析一份用于落库
      const parser = createUpstreamParser()
      for await (const chunk of upstream) {
        for (const event of parser.push(chunk)) {
          if (event.done) sawDone = true
          if (event.content) content += event.content
          if (event.finishReason) finishReason = event.finishReason
          if (event.usage) usage = event.usage
        }

        if (res.writableEnded || res.destroyed) {
          aborted = true
          break
        }
        if (!res.write(chunk)) {
          await Promise.race([once(res, 'drain'), once(res, 'close')])
        }
      }

      if (!aborted) {
        // 部分兼容实现不发 [DONE]，这里补一个，保证客户端能正常收尾
        if (!sawDone) res.write('data: [DONE]\n\n')
        await finalize('completed', finishReason ?? 'stop')
      } else {
        await finalize('aborted', 'aborted')
      }
    } catch (error) {
      // 客户端断开导致上游迭代抛错：按「中断」收尾，不再往已关闭的连接写帧
      if (clientAbort.signal.aborted) {
        await finalize('aborted', 'aborted')
        return
      }

      if (!res.headersSent) {
        // 还没开始流：交回全局 HttpExceptionFilter，返回统一 JSON 错误
        await finalize('error', 'error')
        delegateToFilter = true
        throw error
      }

      writeSseData(res, {
        error: {
          message: error instanceof Error ? error.message : 'AI 流已中断',
          type: 'backend_stream_error',
        },
      })
      if (!res.writableEnded) res.write('data: [DONE]\n\n')
      await finalize('error', 'error')
    } finally {
      stopKeepAlive?.()
      res.off('close', onClose)
      if (!delegateToFilter && !res.writableEnded) res.end()
    }
  }
}
