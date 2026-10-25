import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { AiModel } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import type { ChatCompletionDto } from './dto/chat-completion.dto.js'
import { ModelsService } from './models.service.js'
import { MAX_HISTORY_MESSAGES, buildContext, type PromptMessage } from './prompt.js'

/** 只作用于「拿到上游响应头之前」，避免长回复被整体超时误杀 */
const CONNECT_TIMEOUT_MS = 15_000
const DEFAULT_TITLE = '新对话'
const TITLE_MAX_CHARS = 30
const UPSTREAM_ERROR_DETAIL_CHARS = 300

export interface PreparedTurn {
  conversationId: string
  assistantMessageId: string
  model: AiModel
  messages: PromptMessage[]
  temperature?: number
  maxTokens?: number
}

export interface FinalizeParams {
  assistantMessageId: string
  conversationId: string
  content: string
  status: 'completed' | 'aborted' | 'error'
  finishReason?: string | null
  promptTokens?: number
  completionTokens?: number
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelsService,
  ) {}

  /**
   * 一轮对话的准备：解析/创建会话、解析模型、落 user 消息与 assistant 占位消息、
   * 从数据库重建上下文。任何失败都发生在写 SSE 响应头之前，可直接走全局异常过滤器。
   */
  async prepareTurn(dto: ChatCompletionDto): Promise<PreparedTurn> {
    const content = dto.content.trim()
    if (!content) throw new BadRequestException('content 不能为空')

    const conversation = dto.conversationId
      ? await this.requireConversation(dto.conversationId)
      : await this.createConversation(content, dto.modelId)

    const model = await this.models.resolve(dto.modelId, conversation.modelId)
    if (conversation.modelId !== model.id) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { modelId: model.id },
      })
    }

    await this.prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: 'user', content },
    })

    const assistant = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        status: 'streaming',
        modelId: model.id,
        modelName: model.model,
      },
      select: { id: true },
    })

    const recent = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id, status: 'completed' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true },
    })

    const messages = buildContext({
      systemPrompt: conversation.systemPrompt,
      history: recent
        .reverse()
        .map((message) => ({ role: message.role, content: message.content })),
    })

    this.logger.log(
      `chat 开始: conversation=${conversation.id} model=${model.model} messages=${messages.length}`,
    )

    return {
      conversationId: conversation.id,
      assistantMessageId: assistant.id,
      model,
      messages,
      temperature: dto.temperature ?? model.temperature ?? undefined,
      maxTokens: dto.maxTokens ?? model.maxTokens ?? undefined,
    }
  }

  /** 调上游，返回原始字节流；非 2xx / 非 SSE 在此抛错（此时还没写响应头） */
  async openUpstream(turn: PreparedTurn, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const { model } = turn
    const url = `${model.baseUrl.replace(/\/+$/, '')}/chat/completions`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)
    const combined = AbortSignal.any([signal, controller.signal])

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.model,
          messages: turn.messages,
          stream: true,
          ...(turn.temperature !== undefined ? { temperature: turn.temperature } : {}),
          ...(turn.maxTokens !== undefined ? { max_tokens: turn.maxTokens } : {}),
        }),
        signal: combined,
      })
    } catch {
      if (controller.signal.aborted) throw new BadGatewayException('AI 上游连接超时')
      if (signal.aborted) throw new BadRequestException('客户端已断开')
      throw new BadGatewayException('AI 上游连接失败')
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) throw await this.mapUpstreamError(response)

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      throw new BadGatewayException('AI 上游返回非 SSE 响应，请检查 baseUrl 是否为 OpenAI 兼容接口')
    }
    if (!response.body) throw new BadGatewayException('AI 上游未返回数据流')

    return response.body
  }

  /** 收尾：把累积内容与状态写回 assistant 消息，并刷新会话更新时间 */
  async finalize(params: FinalizeParams): Promise<void> {
    try {
      if (params.status === 'error' && !params.content) {
        // 一个字都没生成就失败了：删掉占位消息，避免历史里留下空白气泡
        await this.prisma.chatMessage.delete({ where: { id: params.assistantMessageId } })
      } else {
        await this.prisma.chatMessage.update({
          where: { id: params.assistantMessageId },
          data: {
            content: params.content,
            status: params.status,
            finishReason: params.finishReason ?? null,
            promptTokens: params.promptTokens ?? null,
            completionTokens: params.completionTokens ?? null,
          },
        })
      }
      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { updatedAt: new Date() },
      })
    } catch (error) {
      this.logger.error(
        `chat 落库失败: message=${params.assistantMessageId} conversation=${params.conversationId}`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  private async requireConversation(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true, modelId: true, systemPrompt: true },
    })
    if (!conversation) throw new NotFoundException('会话不存在')
    return conversation
  }

  private async createConversation(content: string, modelId?: string) {
    let resolvedModelId: string | null = null
    if (modelId) {
      const model = await this.prisma.aiModel.findFirst({
        where: { id: modelId, isActive: true },
        select: { id: true },
      })
      if (!model) throw new NotFoundException('模型不存在或已下线')
      resolvedModelId = model.id
    }

    return this.prisma.conversation.create({
      data: {
        title: content.slice(0, TITLE_MAX_CHARS) || DEFAULT_TITLE,
        modelId: resolvedModelId,
      },
      select: { id: true, modelId: true, systemPrompt: true },
    })
  }

  private async mapUpstreamError(response: Response): Promise<HttpException> {
    let detail = ''
    try {
      detail = (await response.text()).slice(0, UPSTREAM_ERROR_DETAIL_CHARS)
    } catch {
      detail = ''
    }

    // 只记录状态码与上游返回片段，不记录 apiKey
    this.logger.warn(`AI 上游返回 ${response.status}: ${detail}`)

    if (response.status === HttpStatus.BAD_REQUEST) {
      const message = this.extractErrorMessage(detail) ?? 'AI 上游拒绝了该请求'
      return new BadRequestException(message)
    }
    if (response.status === HttpStatus.UNAUTHORIZED || response.status === HttpStatus.FORBIDDEN) {
      return new BadGatewayException('AI 上游鉴权失败，请检查该模型的 apiKey')
    }
    if (response.status === HttpStatus.NOT_FOUND) {
      return new BadGatewayException('AI 上游地址错误，请检查该模型的 baseUrl')
    }
    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException('AI 上游限流，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }

    return new BadGatewayException('AI 上游服务异常')
  }

  private extractErrorMessage(detail: string): string | undefined {
    try {
      const body = JSON.parse(detail) as { error?: { message?: string } | string; message?: string }
      if (typeof body.error === 'string') return body.error
      return body.error?.message ?? body.message
    } catch {
      return undefined
    }
  }
}
