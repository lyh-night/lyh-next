import { HttpStatus, Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client.js'
import { ApiCode } from '../common/errors/api-code.js'
import { ApiException } from '../common/errors/api.exception.js'
import { PrismaService } from '../prisma/prisma.service.js'
import type { ChatHistoryDto } from './dto/chat-history.dto.js'
import type { CreateConversationDto } from './dto/create-conversation.dto.js'
import type { ListConversationsDto } from './dto/list-conversations.dto.js'
import type { UpdateConversationDto } from './dto/update-conversation.dto.js'

const DEFAULT_TITLE = '新对话'
const LAST_MESSAGE_PREVIEW_CHARS = 120

const MESSAGE_SELECT = {
  id: true,
  role: true,
  content: true,
  status: true,
  finishReason: true,
  modelName: true,
  promptTokens: true,
  completionTokens: true,
  createdAt: true,
} as const

function preview(content: string): string {
  return content.length > LAST_MESSAGE_PREVIEW_CHARS
    ? `${content.slice(0, LAST_MESSAGE_PREVIEW_CHARS)}…`
    : content
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    const model = dto.modelId ? await this.findActiveModel(dto.modelId) : null

    return this.prisma.conversation.create({
      data: {
        userId,
        title: dto.title?.trim() || DEFAULT_TITLE,
        systemPrompt: dto.systemPrompt ?? null,
        modelId: model?.id ?? null,
      },
      select: {
        id: true,
        title: true,
        modelId: true,
        systemPrompt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async list(userId: string, dto: ListConversationsDto) {
    const page = dto.page ?? 1
    const limit = dto.limit ?? 20
    const where: Prisma.ConversationWhereInput = { userId }

    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          modelId: true,
          updatedAt: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { role: true, content: true, createdAt: true },
          },
        },
      }),
    ])

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        modelId: row.modelId,
        updatedAt: row.updatedAt,
        messageCount: row._count.messages,
        lastMessage: row.messages[0]
          ? {
              role: row.messages[0].role,
              content: preview(row.messages[0].content),
              createdAt: row.messages[0].createdAt,
            }
          : null,
      })),
      page,
      limit,
      total,
    }
  }

  async detail(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        modelId: true,
        systemPrompt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })

    if (!conversation) {
      throw new ApiException(
        ApiCode.CHAT_CONVERSATION_NOT_FOUND,
        '会话不存在',
        HttpStatus.NOT_FOUND,
      )
    }

    const { _count, ...rest } = conversation
    return { ...rest, messageCount: _count.messages }
  }

  async update(userId: string, id: string, dto: UpdateConversationDto) {
    await this.requireOwned(userId, id)

    const data: {
      title?: string
      systemPrompt?: string | null
      modelId?: string | null
    } = {}

    if (dto.title !== undefined) data.title = dto.title.trim() || DEFAULT_TITLE
    if (dto.systemPrompt !== undefined) data.systemPrompt = dto.systemPrompt.trim() || null
    if (dto.modelId !== undefined) {
      const model = await this.findActiveModel(dto.modelId)
      data.modelId = model.id
    }

    try {
      return await this.prisma.conversation.update({
        where: { id },
        data,
        select: {
          id: true,
          title: true,
          modelId: true,
          systemPrompt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new ApiException(
          ApiCode.CHAT_CONVERSATION_NOT_FOUND,
          '会话不存在',
          HttpStatus.NOT_FOUND,
        )
      }
      throw error
    }
  }

  async remove(userId: string, id: string) {
    const deleted = await this.prisma.conversation.deleteMany({ where: { id, userId } })
    if (deleted.count === 0) {
      throw new ApiException(
        ApiCode.CHAT_CONVERSATION_NOT_FOUND,
        '会话不存在',
        HttpStatus.NOT_FOUND,
      )
    }

    return { success: true }
  }

  /**
   * 撤回最后一轮未完成的回合（重试前调用）：
   * - 末尾是 aborted / error assistant（error 含流中失败但已有部分内容的落库行）→ 连同其 user 一起删除；
   * - 末尾是 user（流开始前失败时 assistant 占位已被后端删除）→ 只删该 user；
   * - 末尾是已完成的回合 → 返回 success: false，不做任何删除。
   */
  async removeLastTurn(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!conversation) {
      throw new ApiException(
        ApiCode.CHAT_CONVERSATION_NOT_FOUND,
        '会话不存在',
        HttpStatus.NOT_FOUND,
      )
    }

    const latest = await this.prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { id: true, role: true, status: true },
    })
    if (latest.length === 0) return { success: true }

    const [last, previous] = latest
    const deleteIds: string[] = []

    if (last.role === 'assistant') {
      if (last.status !== 'aborted' && last.status !== 'error') return { success: false }
      deleteIds.push(last.id)
      if (previous?.role === 'user') deleteIds.push(previous.id)
    } else if (last.role === 'user') {
      deleteIds.push(last.id)
    } else {
      return { success: false }
    }

    await this.prisma.$transaction(
      deleteIds.map((messageId) =>
        this.prisma.chatMessage.deleteMany({ where: { id: messageId } }),
      ),
    )
    return { success: true }
  }

  /**
   * 历史消息：`messageId` 作为游标向前翻页（返回更旧的一页），
   * 输出按 createdAt 升序，前端可直接追加到列表尾部 / 前插到头部。
   */
  async history(userId: string, dto: ChatHistoryDto) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, userId },
      select: { id: true },
    })
    if (!conversation) {
      throw new ApiException(
        ApiCode.CHAT_CONVERSATION_NOT_FOUND,
        '会话不存在',
        HttpStatus.NOT_FOUND,
      )
    }

    const limit = dto.limit ?? 50

    if (dto.messageId) {
      const anchor = await this.prisma.chatMessage.findFirst({
        where: { id: dto.messageId, conversationId: dto.conversationId },
        select: { id: true },
      })
      if (!anchor) {
        throw new ApiException(ApiCode.CHAT_INVALID_ANCHOR, '分页锚点无效', HttpStatus.BAD_REQUEST)
      }
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId: dto.conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(dto.messageId ? { cursor: { id: dto.messageId }, skip: 1 } : {}),
      select: MESSAGE_SELECT,
    })

    const hasMore = rows.length > limit

    return {
      conversationId: dto.conversationId,
      items: rows.slice(0, limit).reverse(),
      hasMore,
    }
  }

  /** 校验会话属于当前用户；越权与不存在统一 30001，不泄露资源存在性 */
  private async requireOwned(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!conversation) {
      throw new ApiException(
        ApiCode.CHAT_CONVERSATION_NOT_FOUND,
        '会话不存在',
        HttpStatus.NOT_FOUND,
      )
    }
  }

  private async findActiveModel(modelId: string) {
    const model = await this.prisma.aiModel.findFirst({
      where: { id: modelId, isActive: true },
      select: { id: true },
    })
    if (!model) {
      throw new ApiException(
        ApiCode.CHAT_MODEL_NOT_FOUND,
        '模型不存在或已下线',
        HttpStatus.NOT_FOUND,
      )
    }
    return model
  }
}
