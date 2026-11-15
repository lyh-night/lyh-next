/** 与后端 `ChatRole` / `ChatMessageStatus` 对齐 */
export type ChatRole = 'user' | 'assistant'
export type ChatMessageStatus = 'streaming' | 'completed' | 'aborted' | 'error'

/** 后端历史消息（GET /api/chat/history 的 items） */
export interface ServerMessage {
  id: string
  role: ChatRole
  content: string
  status: ChatMessageStatus
  finishReason: string | null
  modelName: string | null
  promptTokens: number | null
  completionTokens: number | null
  createdAt: string
}

/** UI 层消息：乐观更新 / 流式累积时还没有服务端 id，用 localId 兜底 */
export interface UiMessage {
  localId: string
  /** 服务端消息 id；乐观消息在收到 X-Message-Id 后回填 */
  id?: string
  role: ChatRole
  content: string
  status: ChatMessageStatus
  finishReason?: string | null
  modelName?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  createdAt: string
  /** 失败时的错误文案（流内错误帧 / 头之前信封失败），显示在消息流里 */
  errorMessage?: string
  /** 失败业务码：30003（无可用模型）时错误气泡内提供「打开设置」入口 */
  errorCode?: number
}

export interface ConversationSummary {
  id: string
  title: string
  modelId: string | null
  updatedAt: string
  messageCount: number
  lastMessage: {
    role: ChatRole
    content: string
    createdAt: string
  } | null
}

export interface ConversationListResult {
  items: ConversationSummary[]
  page: number
  limit: number
  total: number
}

/** GET /api/chat/history 的响应 */
export interface ChatHistoryResult {
  conversationId: string
  items: ServerMessage[]
  hasMore: boolean
}

/** 可用模型（GET /api/chat/models，不含 baseUrl 与密钥） */
export interface ChatModel {
  id: string
  displayName: string
  model: string
  isDefault: boolean
  temperature: number | null
  maxTokens: number | null
}
