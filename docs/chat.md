# AI 对话接口（chat）

> 需求与实现说明：`apps/backend` 的 AI 对话接口。模型配置存数据库、多轮记忆在后端、
> 响应为 **OpenAI 协议的 SSE**，逐帧透传第三方平台。

---

## 一、背景与目标

前端需要一个"和 AI 聊天"的能力，模型由用户自行在数据库里配置（第三方平台的 `baseUrl` /
`apiKey` / `model`），不在环境变量或代码里硬编码。

目标：

- 一套接口支持任意 **OpenAI 兼容**的第三方平台（OpenAI、DeepSeek、Qwen、Ollama、vLLM…）。
- 支持 **多轮对话**：记忆由后端维护，前端只发这一轮的新消息。
- 支持 **对话历史**：会话列表、历史消息分页、删除。
- 响应使用 **OpenAI 协议的 SSE**（`data: {...}` + `data: [DONE]`），前端可逐字渲染。

---

## 二、术语与边界

| 名词                   | 含义                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| 模型配置（`AiModel`）  | 一行 = 一套第三方配置：展示名、`model`、`baseUrl`、`apiKey`、默认参数 |
| 会话（`Conversation`） | 一段多轮对话的容器，含标题、系统提示词、上次使用的模型                |
| 消息（`ChatMessage`）  | 会话内的一条 user / assistant 消息                                    |
| 上下文（context）      | 每次请求实际发给上游的 `messages` 数组，由后端从数据库装配并裁剪      |

边界：

- 只有**响应**遵循 OpenAI 协议；**请求体不是** OpenAI 格式（历史在服务端，不接受客户端传 `messages`）。
- 只支持文本消息，不支持 `tools` / function calling、多模态。
- 只提供流式（`stream: true`），不提供非流式一次性返回。

---

## 三、数据模型

### 3.1 多文件 schema

Prisma 没有 `import` 语法，多模型文件靠 **schema 目录合并**：

```
apps/backend/prisma/
├─ schema.prisma     # datasource + generator + User/Account/Session/VerificationToken
├─ chat.prisma       # ChatRole / ChatMessageStatus + AiModel / Conversation / ChatMessage
└─ prisma.config.ts  # schema: 'prisma'（目录，而不是某个文件）
```

`prisma.config.ts` 中 `schema` 指向目录后，`prisma validate` / `generate` / `db push` 都会
把目录下所有 `*.prisma` 合成一个逻辑 schema。`chat.prisma` 里不写 `generator` 与 `datasource`。

> 已验证：Prisma 7.10.1 默认支持多文件 schema，无需 `previewFeatures`；
> `prisma generate` 的输出位置仍由 `schema.prisma` 的 `output = "../src/generated/prisma"` 决定，路径不变。

### 3.2 表结构

```prisma
enum ChatRole { system user assistant }
enum ChatMessageStatus { streaming completed aborted error }

model AiModel {
  id          String   @id @default(cuid())
  displayName String   // 前端展示名
  model       String   // 传给上游的 model 字段
  baseUrl     String   // OpenAI 兼容地址，如 https://api.deepseek.com/v1
  apiKey      String   // 永不出现在接口响应与日志中
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  temperature Float?
  maxTokens   Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  conversations Conversation[]
  messages      ChatMessage[]

  @@index([isActive, sortOrder])
}

model Conversation {
  id           String   @id @default(cuid())
  title        String   @default("新对话")
  systemPrompt String?
  modelId      String?
  model        AiModel? @relation(fields: [modelId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  messages ChatMessage[]

  @@index([updatedAt])
}

model ChatMessage {
  id               String            @id @default(cuid())
  conversationId   String
  conversation     Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role             ChatRole
  content          String            @db.Text
  status           ChatMessageStatus @default(completed)
  finishReason     String?           // stop | length | aborted | error
  modelId          String?
  model            AiModel?          @relation(fields: [modelId], references: [id], onDelete: SetNull)
  modelName        String?           // 快照：配置被删后历史仍可读
  promptTokens     Int?
  completionTokens Int?
  createdAt        DateTime          @default(now())

  @@index([conversationId, createdAt])
}
```

字段说明：

- `status=streaming`：流式进行中；`completed` 正常结束；`aborted` 客户端中断；`error` 出错。
- `modelName` 是快照，避免模型配置删除后历史消息看不出"这条是谁答的"。
- 删除会话 → 级联删除消息；删除模型配置 → 消息与会话的 `modelId` 置空（历史保留）。

### 3.3 手动写入配置

```sql
INSERT INTO "AiModel"
  ("id","displayName","model","baseUrl","apiKey","isDefault","isActive","sortOrder","createdAt","updatedAt")
VALUES
  ('m_deepseek','DeepSeek 对话','deepseek-chat','https://api.deepseek.com/v1','sk-xxx',true,true,0,now(),now());
```

也可以用 `pnpm db:studio` 可视化录入。`isDefault=true` 的那条用于"用户没选模型"时的兜底。

---

## 四、接口契约

所有接口挂在 `/api/chat` 下，错误使用统一结构：

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request",
  "path": "/api/chat/...",
  "timestamp": "..."
}
```

### 4.1 模型列表

`GET /api/chat/models`

```json
{
  "items": [
    {
      "id": "m_deepseek",
      "displayName": "DeepSeek 对话",
      "model": "deepseek-chat",
      "isDefault": true,
      "temperature": null,
      "maxTokens": null
    }
  ]
}
```

只返回 `isActive=true` 的项；**不返回 `baseUrl` 与 `apiKey`**。

### 4.2 会话

| 方法     | 路径                                      | 说明                                                  |
| -------- | ----------------------------------------- | ----------------------------------------------------- |
| `POST`   | `/api/chat/conversations`                 | `{ title?, modelId?, systemPrompt? }`，返回会话元信息 |
| `GET`    | `/api/chat/conversations?page=1&limit=20` | 分页列表，按 `updatedAt` 倒序                         |
| `GET`    | `/api/chat/conversations/:id`             | 会话详情（不含消息）                                  |
| `PATCH`  | `/api/chat/conversations/:id`             | `{ title?, modelId?, systemPrompt? }`                 |
| `DELETE` | `/api/chat/conversations/:id`             | 删除会话（级联删消息），返回 `{ success: true }`      |

列表项：

```json
{
  "id": "c_xxx",
  "title": "用一句话解释 SSE",
  "modelId": "m_deepseek",
  "updatedAt": "2026-10-25T13:00:00.000Z",
  "messageCount": 6,
  "lastMessage": {
    "role": "assistant",
    "content": "SSE 是……",
    "createdAt": "2026-10-25T13:00:00.000Z"
  }
}
```

`lastMessage.content` 超过 120 字会截断并加 `…`。

### 4.3 历史消息（参数式）

`GET /api/chat/history?conversationId=<id>&limit=50&messageId=<messageId>`

| 参数             | 必填 | 说明                                                         |
| ---------------- | ---- | ------------------------------------------------------------ |
| `conversationId` | 是   | 会话 id                                                      |
| `limit`          | 否   | 每页条数，默认 50，最大 200                                  |
| `messageId`      | 否   | 分页锚点：返回该消息**之前**（更旧）的一页；省略则取最近一页 |

```json
{
  "conversationId": "c_xxx",
  "items": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "用一句话解释 SSE",
      "status": "completed",
      "finishReason": null,
      "modelName": null,
      "promptTokens": null,
      "completionTokens": null,
      "createdAt": "2026-10-25T13:00:00.000Z"
    }
  ],
  "hasMore": true
}
```

- `items` 按 `createdAt` 升序，前端可直接"尾部追加 / 头部前插"。
- 会话不存在 → 404；`messageId` 不属于该会话 → 400 `分页锚点无效`。

### 4.4 对话（SSE）

`POST /api/chat/completions`

```json
{
  "conversationId": "c_xxx",
  "modelId": "m_deepseek",
  "content": "用一句话解释 SSE",
  "temperature": 0.7,
  "maxTokens": 1024
}
```

| 字段             | 必填 | 说明                                             |
| ---------------- | ---- | ------------------------------------------------ |
| `content`        | 是   | 本轮用户输入，≤ 8000 字                          |
| `conversationId` | 否   | 省略则自动建会话（标题取 `content` 前 30 字）    |
| `modelId`        | 否   | 省略则用会话上次模型 → 默认模型 → 第一个可用模型 |
| `temperature`    | 否   | 0–2，省略则用模型配置                            |
| `maxTokens`      | 否   | ≥1，省略则用模型配置                             |

响应头：

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
X-Conversation-Id: c_xxx
X-Message-Id: msg_xxx
```

响应体（**与上游逐字节一致**）：

```
data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"SSE"},"finish_reason":null}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

```

本端只额外产生两种帧（不破坏协议解析）：

| 场景                             | 帧                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| 心跳（15s 一次，防代理空闲断开） | `: ping\n\n`                                                                       |
| 流已开始后的错误                 | `data: {"error":{"message":"...","type":"backend_stream_error"}}` + `data: [DONE]` |

上游没发 `[DONE]` 时，后端会补一个，保证客户端能收尾。

### 4.5 错误码

| 场景                                    | 状态码 | message                                                         |
| --------------------------------------- | ------ | --------------------------------------------------------------- |
| 会话不存在                              | 404    | `会话不存在`                                                    |
| 模型不存在/已下线                       | 404    | `模型不存在或已下线`                                            |
| `content` 为空或超长                    | 400    | 校验管道给出的提示                                              |
| 分页锚点不属于该会话                    | 400    | `分页锚点无效`                                                  |
| 没有可用的模型                          | 503    | `尚未配置可用的 AI 模型，请在数据库的 AiModel 表中新增一条记录` |
| 上游 400                                | 400    | 透传上游 `error.message`                                        |
| 上游 401 / 403                          | 502    | `AI 上游鉴权失败，请检查该模型的 apiKey`                        |
| 上游 404                                | 502    | `AI 上游地址错误，请检查该模型的 baseUrl`                       |
| 上游 429                                | 429    | `AI 上游限流，请稍后重试`                                       |
| 上游 5xx / 网络错误 / 连接超时（15s）   | 502    | `AI 上游服务异常` / `AI 上游连接失败` / `AI 上游连接超时`       |
| 上游返回 200 但不是 `text/event-stream` | 502    | `AI 上游返回非 SSE 响应，请检查 baseUrl 是否为 OpenAI 兼容接口` |

以上错误都发生在写响应头之前，返回统一 JSON。

补充约定：

- 一个字都没生成就失败 → **删除** assistant 占位消息，只保留 user 消息（历史里不会出现空白气泡，前端可直接重试）。
- 已经有部分内容才失败 / 中断 → 保留消息，`status` 分别为 `error` / `aborted`，`content` 为已生成片段。
- **流已开始后**的错误走 SSE 错误帧（`backend_stream_error`）+ `data: [DONE]`。

---

## 五、多轮记忆策略

### 5.1 为什么放后端

| 方案                           | 取舍                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| 前端保存历史，每次全量发送     | 历史有两份（客户端 + 服务端），容易不一致；换设备/刷新会丢；无法做统一裁剪与计费  |
| **后端从数据库装配（本方案）** | 只有一份历史；跨设备/刷新可续聊；裁剪策略集中；后续加摘要压缩、系统提示词只改后端 |

### 5.2 装配规则（`src/chat/prompt.ts`）

```ts
DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'
MAX_HISTORY_MESSAGES = 20 // 除 system 外最多 20 条
MAX_CONTEXT_CHARS = 12_000 // 字符数上限
```

1. 首条固定 `system`（会话 `systemPrompt` → 默认值）。
2. 取该会话最近 20 条 `status=completed` 的消息，按时间升序。
3. 总字符超限时从**最旧**的消息开始丢，当前这轮 user 消息永远保留。
4. 裁剪后若首条是 assistant，继续丢弃，避免上下文从"助手回复"开始。

### 5.3 哪些消息不进上下文

- `aborted` / `error` 的 assistant 消息**不参与**后续上下文（避免半截回复被当成事实），但历史接口仍会返回。
- 同一个会话切换模型时，历史照常带过去（`Conversation.modelId` 会被更新）。

---

## 六、流式与中断

### 6.1 时序

```text
POST /api/chat/completions
  ├─ 校验 DTO（content 必填、≤8000 字）
  ├─ 解析/创建会话 → 解析模型（请求 > 会话 > 默认 > 首个可用）
  ├─ 落 user 消息（completed）
  ├─ 落 assistant 占位消息（streaming，content=''）→ 得到 messageId
  ├─ 从数据库取历史 → buildContext() 裁剪
  ├─ 调上游 POST {baseUrl}/chat/completions（stream: true）
  ├─ 写 SSE 头（含 X-Conversation-Id / X-Message-Id）→ 逐帧透传 + 累积
  └─ 结束 / 中断 → 更新 assistant 消息 → 刷新 conversation.updatedAt
```

### 6.2 关键实现点

- 不使用 Nest 的 `@Sse()`：它会把返回值序列化成 Nest 自己的帧，丢掉 `[DONE]` 与注释帧。
- 不引入 `openai` SDK：内置 `fetch` + `ReadableStream` 即可，零新依赖，天然兼容各兼容平台。
- 字节级透传：`res.write(chunk)` 写原始 `Uint8Array`，不做重新序列化。
- 另解析一份仅用于累积 `delta.content` / `finish_reason` / `usage`，落库用。
- 背压：`res.write` 返回 `false` 时等 `drain`（同时监听 `close`，避免客户端断开后卡死）。
- 中断：`res.on('close')` → `AbortController.abort()`，上游连接随之中止，消息落 `aborted`。
- 超时：15s 仅作用于"拿到响应头之前"，拿到后清除，避免长回复被整体超时误杀。
- 并发：每个请求独立 `AbortController`，服务无共享可变状态。

---

## 七、配置与运维

- **无需新增环境变量**：模型配置全部在数据库 `AiModel` 表。
- 切换模型：把旧行 `isActive=false`，或直接插入新行。
- 密钥安全：`apiKey` 目前**明文**存库（与 Prisma 默认一致），接口与日志都不会输出；
  后续可加 `ENCRYPTION_KEY` 做 AES 加密（见"非目标"）。
- 代理部署：SSE 需要关掉缓冲（已返回 `X-Accel-Buffering: no`，nginx 侧也可 `proxy_buffering off`）。
- 鉴权：当前接口**无鉴权**，与 `verify-credentials` 一致（浏览器侧无法安全持有共享密钥）。
  一旦部署到公网，必须先加鉴权（见"非目标"）。

---

## 八、前端接入

`EventSource` 只支持 GET，无法带 JSON body，因此必须用 `fetch` + 流式读取：

```ts
const response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ conversationId, modelId, content }),
})

const conversationId = response.headers.get('X-Conversation-Id')
const messageId = response.headers.get('X-Message-Id')

const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })

  let index = buffer.indexOf('\n\n')
  while (index >= 0) {
    const event = buffer.slice(0, index)
    buffer = buffer.slice(index + 2)
    index = buffer.indexOf('\n\n')

    const data = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')
    if (!data || data === '[DONE]') continue

    const chunk = JSON.parse(data)
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) appendToBubble(delta)
  }
}
```

注意：

- 自定义响应头需要后端 CORS 的 `exposedHeaders`（已配置 `X-Conversation-Id`、`X-Message-Id`）。
- 对话页建议做成 Client Component，边收 delta 边渲染；不要在渲染期间重建 reader。

---

## 九、验收标准

1. 连续两轮对话，第二轮上游实际收到的 `messages` 包含第一轮的 assistant 回复。
2. `curl -N` 能看到逐帧输出、总耗时约等于上游生成时间（无整体缓冲），末尾 `data: [DONE]`。
3. 客户端中断（`curl --max-time 1`）后上游连接关闭，数据库里该 assistant 消息 `status=aborted` 且保留已生成内容。
4. 会话列表有 `messageCount` 与 `lastMessage`；历史接口按游标翻页且 `hasMore` 正确；删除会话后消息级联删除。
5. 无可用模型 → 503；上游 401 → 502；上游返回非 SSE → 502；会话不存在 → 404。
6. `pnpm lint` / `pnpm typecheck` / `pnpm build` 全绿。

---

## 十、非目标与后续

本轮不做：

- 前端对话 UI 与 SSE 客户端封装（`apps/frontend`）。
- `tools` / function calling、多模态（图片、音频）。
- token 级上下文裁剪、历史摘要压缩、向量记忆。
- `apiKey` 加密（AES + `ENCRYPTION_KEY`）、限流（`@nestjs/throttler`）、配额与用量统计。
- 模型配置的管理接口 / 管理界面（本轮只手动写库）。
- 会话归属用户：后续接入鉴权时，给 `Conversation` 加 `userId` 关联 `User`，并在查询处按用户过滤（需要一次 `db:push`）。
