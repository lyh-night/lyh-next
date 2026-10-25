import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { AiModel, Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import type { CreateAiModelDto } from './dto/create-ai-model.dto.js'
import type { UpdateAiModelDto } from './dto/update-ai-model.dto.js'

/** 聊天选择器用的模型信息（不含 baseUrl / apiKey） */
export interface ModelSummary {
  id: string
  displayName: string
  model: string
  isDefault: boolean
  temperature: number | null
  maxTokens: number | null
}

/** 设置页用的模型配置：baseUrl 可见，apiKey 只给掩码 */
export interface ModelConfig {
  id: string
  provider: string | null
  displayName: string
  model: string
  baseUrl: string
  apiKeyMasked: string
  isDefault: boolean
  isActive: boolean
  sortOrder: number
  temperature: number | null
  maxTokens: number | null
  createdAt: Date
  updatedAt: Date
}

const MODEL_SUMMARY_SELECT = {
  id: true,
  displayName: true,
  model: true,
  isDefault: true,
  temperature: true,
  maxTokens: true,
} as const

const MODEL_CONFIG_SELECT = {
  id: true,
  provider: true,
  displayName: true,
  model: true,
  baseUrl: true,
  apiKey: true,
  isDefault: true,
  isActive: true,
  sortOrder: true,
  temperature: true,
  maxTokens: true,
  createdAt: true,
  updatedAt: true,
} as const

type ModelConfigRow = Prisma.AiModelGetPayload<{ select: typeof MODEL_CONFIG_SELECT }>

/** 密钥掩码：sk-****abcd（长度不足时全部打码） */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 3)}****${apiKey.slice(-4)}`
}

/** 去掉 baseUrl 末尾多余的斜杠，拼 /chat/completions 时不会出现双斜杠 */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

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

  /** 设置页列表：包含停用的模型，密钥只返回掩码 */
  async listConfigs(): Promise<{ items: ModelConfig[] }> {
    const rows = await this.prisma.aiModel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: MODEL_CONFIG_SELECT,
    })

    return { items: rows.map((row) => this.toConfig(row)) }
  }

  async create(dto: CreateAiModelDto): Promise<ModelConfig> {
    const data = {
      provider: dto.provider?.trim() || null,
      displayName: dto.displayName.trim(),
      model: dto.model.trim(),
      baseUrl: normalizeBaseUrl(dto.baseUrl),
      apiKey: dto.apiKey.trim(),
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      temperature: dto.temperature ?? null,
      maxTokens: dto.maxTokens ?? null,
    }

    const created = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.aiModel.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      }
      return tx.aiModel.create({ data, select: MODEL_CONFIG_SELECT })
    })

    return this.toConfig(created)
  }

  async update(id: string, dto: UpdateAiModelDto): Promise<ModelConfig> {
    const exists = await this.prisma.aiModel.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundException('模型不存在')

    const data: Prisma.AiModelUpdateInput = {}
    if (dto.provider !== undefined) data.provider = dto.provider.trim() || null
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim()
    if (dto.model !== undefined) data.model = dto.model.trim()
    if (dto.baseUrl !== undefined) data.baseUrl = normalizeBaseUrl(dto.baseUrl)
    // 密钥留空表示保留原值，避免编辑其它字段时被迫重新输入
    if (dto.apiKey !== undefined && dto.apiKey.trim()) data.apiKey = dto.apiKey.trim()
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder
    if (dto.temperature !== undefined) data.temperature = dto.temperature
    if (dto.maxTokens !== undefined) data.maxTokens = dto.maxTokens

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.aiModel.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
      return tx.aiModel.update({ where: { id }, data, select: MODEL_CONFIG_SELECT })
    })

    return this.toConfig(updated)
  }

  async remove(id: string): Promise<{ success: true }> {
    const deleted = await this.prisma.aiModel.deleteMany({ where: { id } })
    if (deleted.count === 0) throw new NotFoundException('模型不存在')
    return { success: true }
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

  private toConfig(row: ModelConfigRow): ModelConfig {
    const { apiKey, ...rest } = row
    return { ...rest, apiKeyMasked: maskApiKey(apiKey) }
  }
}
