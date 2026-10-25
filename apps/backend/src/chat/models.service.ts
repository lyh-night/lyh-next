import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { AiModel } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'

/** 对外暴露的模型信息（绝不包含 baseUrl / apiKey） */
export interface ModelSummary {
  id: string
  displayName: string
  model: string
  isDefault: boolean
  temperature: number | null
  maxTokens: number | null
}

const MODEL_SUMMARY_SELECT = {
  id: true,
  displayName: true,
  model: true,
  isDefault: true,
  temperature: true,
  maxTokens: true,
} as const

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<{ items: ModelSummary[] }> {
    const items = await this.prisma.aiModel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: MODEL_SUMMARY_SELECT,
    })

    return { items }
  }

  /**
   * 模型选择优先级：请求指定 → 会话上次使用 → 数据库默认 → 第一个可用
   * 请求显式指定的模型不存在时直接 404，避免静默回退到别的模型。
   */
  async resolve(modelId?: string | null, conversationModelId?: string | null): Promise<AiModel> {
    const preferredId = modelId ?? conversationModelId ?? undefined

    if (preferredId) {
      const model = await this.prisma.aiModel.findFirst({
        where: { id: preferredId, isActive: true },
      })
      if (model) return model
      if (modelId) throw new NotFoundException('模型不存在或已下线')
    }

    const fallback = await this.prisma.aiModel.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    if (!fallback) {
      throw new ServiceUnavailableException(
        '尚未配置可用的 AI 模型，请在数据库的 AiModel 表中新增一条记录',
      )
    }

    return fallback
  }
}
