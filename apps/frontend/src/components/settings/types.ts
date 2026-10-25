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
  createdAt: string
  updatedAt: string
}

/** 新建/编辑时提交给后端的字段（apiKey 在编辑时留空表示不修改） */
export interface ModelPayload {
  provider?: string
  displayName: string
  model: string
  baseUrl: string
  apiKey?: string
  isDefault?: boolean
  isActive?: boolean
  temperature?: number
  maxTokens?: number
}

/** 常见提供商预设：选中后自动填充 Base URL，减少手输错误 */
export const PROVIDER_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
] as const
