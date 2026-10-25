import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client.js'
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

  async create(dto: CreateConversationDto) {
    const model = dto.modelId ? await this.findActiveModel(dto.modelId) : null

    return this.prisma.conversation.create({
      data: {
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

  async list(dto: ListConversationsDto) {
    const page = dto.page ?? 1
    const limit = dto.limit ?? 20

    const [total, rows] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.conversation.findMany({
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

  async detail(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
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

    if (!conversation) throw new NotFoundException('会话不存在')

    const { _count, ...rest } = conversation
    return { ...rest, messageCount: _count.messages }
  }

  async update(id: string, dto: UpdateConversationDto) {
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
      if (isRecordNotFound(error)) throw new NotFoundException('会话不存在')
      throw error
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.conversation.delete({ where: { id } })
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException('会话不存在')
      throw error
    }

    return { success: true }
  }

  /**
   * 历史消息：`messageId` 作为游标向前翻页（返回更旧的一页），
   * 输出按 createdAt 升序，前端可直接追加到列表尾部 / 前插到头部。
   */
  async history(dto: ChatHistoryDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      select: { id: true },
    })
    if (!conversation) throw new NotFoundException('会话不存在')

    const limit = dto.limit ?? 50

    if (dto.messageId) {
      const anchor = await this.prisma.chatMessage.findFirst({
        where: { id: dto.messageId, conversationId: dto.conversationId },
        select: { id: true },
      })
      if (!anchor) throw new BadRequestException('分页锚点无效')
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

  private async findActiveModel(modelId: string) {
    const model = await this.prisma.aiModel.findFirst({
      where: { id: modelId, isActive: true },
      select: { id: true },
    })
    if (!model) throw new NotFoundException('模型不存在或已下线')
    return model
  }
}
