# 后端响应与错误处理

> 改造设计与实施记录：`apps/backend` 的 JSON 接口在后端可达时 HTTP 一律 200，业务结果由响应体的 `code` / `message` 表达。
>
> **P1–P3 已于 2026-11 实施**（见 §十三）：信封已扁平化、业务码已落地、body-parser / Prisma / stack / 日志 / 未知路由已按 §7 收口。当前代码是唯一事实来源，本文保留作设计依据与回归对照。
>
> 阅读顺序：§一 背景 → §五–§六 契约与码表 → §九 迁移 → §十三 实施状态；§二–§四是**改造前的历史记录**（存档）。

---

## 一、背景与目标

### 1.1 项目约定

后端服务正常时，所有 JSON 接口（包括业务失败）都返回 **HTTP 200**；失败信息放在响应体里（下面是目标结构，当前实现仍包一层 `status`，见 §2.8）：

```json
{ "code": 10002, "message": "未登录或登录已过期", "data": null }
```

这样约定的目的：

- 前端只需要判断 `code`，不用同时处理「HTTP 状态 + 业务状态」两套分支；
- 浏览器/axios 不会把业务失败当成传输层异常，统一走一套错误提示与会话失效逻辑；
- 反向代理、网关、CDN 不会因为 4xx/5xx 触发自己的错误页或重试策略。

代价是 HTTP 状态码不再反映业务结果，**监控与告警必须改用响应体里的 `code`**（见 §十一）。

### 1.2 术语

| 术语             | 含义                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| HTTP 状态码      | 传输层结果，JSON 接口约定恒为 200                                      |
| 业务码（`code`） | 响应体里的项目自定义状态码，`0` 表示成功，非 0 表示失败                |
| 响应信封         | 统一包裹业务数据的结构，成功与失败共用同一外形                         |
| 预期错误         | 参数校验、未登录、资源不存在、冲突、限流等可预期结果                   |
| 未预期异常       | 代码缺陷、数据库/上游故障等，客户端只应看到通用文案                    |
| SSE              | `POST /api/chat/completions` 的 `text/event-stream` 流式响应，不包信封 |

### 1.3 适用范围

- 适用：`/api/*` 下所有返回 JSON 的接口，含 `GET /api`、`GET /api/health`、`/api/auth/*`、`/api/chat/*`。
- 特殊：SSE 成功响应是流，不包信封；写响应头之前的失败仍返回 JSON 信封。
- 不适用：Swagger UI/静态资源、CORS 预检（204）、反向代理/网关自身返回的 502/504、进程未启动时的连接失败。

### 1.4 目标

1. JSON 接口在后端可达时 HTTP 恒为 200。
2. 失败时返回顶层的 `code` 与 `message`，不再有 `status` 中间层。
3. `code` 是项目自定义的业务码，不再直接复制 HTTP 状态码。
4. `stack` 只在必要的排查场景返回，不作为 4xx 的常规字段。
5. 前端、Swagger、文档、skill 与后端契约保持一致，避免漂移。

---

## 二、改造前的实现链路（存档）

> 以下为 2026-11 改造前的状态，保留用于对照；当前实现见 §十三 与代码。

### 2.1 执行顺序

```text
客户端
  │
  ▼
Express 中间件：cookieParser → body-parser(2mb) → CORS
  │
  ▼
全局守卫 JwtAuthGuard（@Public() 放行；失败抛 401）
  │
  ▼
拦截器 LoggingInterceptor（外层，负责计时与访问日志）
  │
  ▼
拦截器 TransformInterceptor（内层，负责成功信封）
  │
  ▼
ValidationPipe → Controller → Service → Prisma / AI 上游
  │
  ├─ 正常返回 ──▶ TransformInterceptor 包成
  │                { status: { code: 0, message: '' }, data, stack: [] }
  │
  └─ 抛异常 ────▶ HttpExceptionFilter 包成
                   { status: { code, message }, data: null, stack }
                      │
                      ▼
                 HTTP 200 JSON
```

- 过滤器捕获的是**整条链路**的异常：守卫、管道、controller、service、拦截器抛出的错误都会进入 `HttpExceptionFilter`。
- NestJS 12 还会把 **Express 中间件、未匹配路由、body-parser** 抛出的错误汇入同一异常层（见 §2.7），所以这些错误同样返回 HTTP 200 信封。
- SSE 通过 `@SkipResponseEnvelope()` 与 `@Res()` 自行写响应，成功流不经过 `TransformInterceptor`。

### 2.2 全局注册

`apps/backend/src/common/common.module.ts` 以 DI token 注册，禁止在 `main.ts` 手工 `new`：

```ts
providers: [
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
]
```

- 同类增强器的执行顺序 = `providers` 声明顺序，`LoggingInterceptor` 在外层，耗时统计才覆盖 `TransformInterceptor`。
- 全局登录守卫在 `auth/auth.module.ts` 用 `APP_GUARD` 注册。

### 2.3 成功响应

`TransformInterceptor` 的职责：

1. 读取 `@SkipResponseEnvelope()` 元数据；命中则直接返回原始数据，不包信封。
2. 若响应已开始（SSE `headersSent`），同样直接返回，避免二次包装。
3. 其余情况统一返回 `{ status: { code: 0, message: '' }, data: data ?? null, stack: [] }`。

### 2.4 错误响应

`HttpExceptionFilter`（`@Catch()`，无差别捕获）的当前行为：

- `code`：`exception instanceof HttpException ? exception.getStatus() : 500`。
- `message`：
  - `HttpException.getResponse()` 为字符串 → 直接使用；
  - 为对象且 `message` 是字符串 → 使用；
  - `message` 是数组（`ValidationPipe`）→ 过滤字符串后用「；」拼接；
  - 取不到或为空 → `请求失败，请稍后重试`；
  - 非 `HttpException` → `服务器内部错误`。
- `stack`：任何 `Error` 的 `stack` 按行拆分；非 `Error` 返回 `[]`。
- 日志：非 `HttpException` 记 `logger.error(method + url + 未处理异常, stack)`；`HttpException` 不打堆栈（视为正常业务流）。
- 写响应：`response.status(200).json(body)`；若 `headersSent` 为真（SSE 已写头），只记日志并返回，不再写 JSON。

### 2.5 访问日志

`LoggingInterceptor` 输出 `METHOD path status 耗时ms`：

- 成功：`status = response.statusCode`（200）。
- 异常：`status = error.status ?? 500`，即异常对象自带的 HTTP 状态（401/404/500…），**不是实际写出的 HTTP 200**，也不包含业务码。

### 2.6 SSE 的错误路径

`apps/backend/src/chat/chat.controller.ts` 与 `chat/sse.ts`：

- 成功：`res.writeHead(200, SSE_HEADERS + 会话/消息 id)`，逐帧透传上游，补 `data: [DONE]`，不包信封。
- 写头**之前**失败：`delegateToFilter = true` 并把异常重新抛出，交给全局过滤器返回 JSON 信封（HTTP 200）。
- 写头**之后**失败：写入 `data: {"error":{"message":"...","type":"backend_stream_error"}}`，再写 `data: [DONE]`，不改成 JSON。
- 客户端断开：按 aborted 收尾，不再向已关闭连接写帧。

### 2.7 NestJS 12 的全局错误层（中间件 / 404 / body-parser）

这部分不在业务代码里，但决定了「全 200」是否成立，需要记录：

- `routes-resolver` 在 `init()` 时注册 `registerNotFoundHandler()` 与 `registerExceptionHandler()`。
- 未匹配路由：抛出 `NotFoundException("Cannot GET /api/...")`，进入全局过滤器 → HTTP 200 + `status.code=404`。
- `ExpressAdapter.mapException()` 把 `SyntaxError` / `URIError` 转成 `BadRequestException`；因此**非法 JSON** 进入过滤器 → HTTP 200 + `status.code=400`，但 message 是 body-parser 的英文解析信息（例如 `Unexpected token ... in JSON`）。
- `PayloadTooLargeError`（请求体超过 `main.ts` 里 2mb 上限）**不是** `SyntaxError`，`mapException` 原样返回；它不是 `HttpException`，所以当前过滤器按 500 处理 → HTTP 200 + `status.code=500`，message 为「服务器内部错误」。

> 这是 NestJS 12 的运行时行为。升级 Nest 大版本或更换 HTTP adapter 时，需要重新核对该错误层是否仍然存在。

### 2.8 改造前的信封示例

成功（`POST /api/auth/login`）：

```json
{
  "status": { "code": 0, "message": "" },
  "data": { "user": { "id": "u_1", "email": "user@example.com" } },
  "stack": []
}
```

业务失败（未登录）：

```json
{
  "status": { "code": 401, "message": "未登录或登录已过期" },
  "data": null,
  "stack": ["UnauthorizedException: 未登录或登录已过期", "    at ..."]
}
```

健康检查（注意 `data.status` 与信封 `status` 同名）：

```json
{
  "status": { "code": 0, "message": "" },
  "data": { "status": "ok", "uptime": 123, "timestamp": "...", "version": "0.0.0" },
  "stack": []
}
```

---

## 三、改造前的错误映射表（存档）

### 3.1 总表

| 场景                | 异常来源                                       | 实际 HTTP | `status.code` | message 来源                    | `stack` |
| ------------------- | ---------------------------------------------- | --------- | ------------- | ------------------------------- | ------- |
| 参数校验失败        | `ValidationPipe` → `BadRequestException`       | 200       | 400           | 校验文案，数组用「；」拼接      | 有      |
| 未登录 / token 无效 | `JwtAuthGuard` → `UnauthorizedException`       | 200       | 401           | `未登录或登录已过期`            | 有      |
| 业务冲突            | `ConflictException`                            | 200       | 409           | service 文案                    | 有      |
| 资源不存在          | `NotFoundException`                            | 200       | 404           | service 文案 / `Cannot GET ...` | 有      |
| 上游限流            | `HttpException(429)`                           | 200       | 429           | `AI 上游限流，请稍后重试`       | 有      |
| 上游异常            | `BadGatewayException`                          | 200       | 502           | service 文案                    | 有      |
| 无可用模型          | `ServiceUnavailableException`                  | 200       | 503           | service 文案                    | 有      |
| 非法 JSON           | Nest 12 `mapException` → `BadRequestException` | 200       | 400           | body-parser 英文信息            | 有      |
| 请求体 > 2mb        | `PayloadTooLargeError`（非 HttpException）     | 200       | 500           | `服务器内部错误`                | 有      |
| 未预期异常          | 任意 `Error`                                   | 200       | 500           | `服务器内部错误`                | 有      |
| SSE 写头后失败      | 任意异常                                       | 200       | 无 JSON       | SSE `backend_stream_error` 帧   | 无      |

### 3.2 抛错点清单

**认证 `auth/auth.service.ts`、`auth/jwt-auth.guard.ts`**

| 场景                       | 异常                    | 当前 code | message                |
| -------------------------- | ----------------------- | --------- | ---------------------- |
| 注册邮箱已存在             | `ConflictException`     | 409       | `该邮箱已被注册`       |
| 登录用户不存在 / 密码错误  | `UnauthorizedException` | 401       | `邮箱或密码错误`       |
| `/me` 时用户已被删除       | `UnauthorizedException` | 401       | `用户不存在或已被删除` |
| 未携带 / 无效 / 过期 token | `UnauthorizedException` | 401       | `未登录或登录已过期`   |

**对话 `chat/chat.service.ts`、`chat/conversations.service.ts`、`chat/models.service.ts`**

| 场景                      | 异常                          | 当前 code | message                                                         |
| ------------------------- | ----------------------------- | --------- | --------------------------------------------------------------- |
| `content` 为空            | `BadRequestException`         | 400       | `content 不能为空`                                              |
| 会话不存在                | `NotFoundException`           | 404       | `会话不存在`                                                    |
| 请求指定的模型不存在/下线 | `NotFoundException`           | 404       | `模型不存在或已下线`                                            |
| 分页锚点无效              | `BadRequestException`         | 400       | `分页锚点无效`                                                  |
| 没有可用的模型            | `ServiceUnavailableException` | 503       | `尚未配置可用的 AI 模型，请在数据库的 AiModel 表中新增一条记录` |
| 上游连接超时（15s）       | `BadGatewayException`         | 502       | `AI 上游连接超时`                                               |
| 客户端已断开（写头前）    | `BadRequestException`         | 400       | `客户端已断开`                                                  |
| 上游连接失败              | `BadGatewayException`         | 502       | `AI 上游连接失败`                                               |
| 上游非 SSE 响应           | `BadGatewayException`         | 502       | `AI 上游返回非 SSE 响应，请检查 baseUrl 是否为 OpenAI 兼容接口` |
| 上游未返回数据流          | `BadGatewayException`         | 502       | `AI 上游未返回数据流`                                           |
| 上游 400                  | `BadRequestException`         | 400       | 透传上游 `error.message`                                        |
| 上游 401 / 403            | `BadGatewayException`         | 502       | `AI 上游鉴权失败，请检查该模型的 apiKey`                        |
| 上游 404                  | `BadGatewayException`         | 502       | `AI 上游地址错误，请检查该模型的 baseUrl`                       |
| 上游 429                  | `HttpException(429)`          | 429       | `AI 上游限流，请稍后重试`                                       |
| 上游 5xx / 网络错误       | `BadGatewayException`         | 502       | `AI 上游服务异常`                                               |

**模型配置 `chat/models.service.ts`**

| 场景                | 异常                | 当前 code | message              |
| ------------------- | ------------------- | --------- | -------------------- |
| 更新/删除模型不存在 | `NotFoundException` | 404       | `模型不存在`         |
| 请求指定模型不存在  | `NotFoundException` | 404       | `模型不存在或已下线` |

### 3.3 现有文档里的错误码

- `docs/auth.md` §4.6：401 / 409 / 400 的表格，全部写作 `status.code`。
- `docs/chat.md` §4.5：400 / 404 / 429 / 502 / 503 的表格，全部写作 `status.code`。
- `docs/coding-conventions.md` §四：`成功判断看 status.code === 0`。
- `docs/monorepo.md` §19.3：响应结构写作 `{ status: { code, message }, data, stack }`。
- `.agent/skills/nestjs-api-contract/SKILL.md` 与 `nestjs-error-handling/SKILL.md`：同样以 `status` 信封为准。

这些是**当前状态**的准确描述；实施 §九 的 P1 后需要同步修改（见 §十二）。

---

## 四、改造前的问题清单（存档）

### 4.1 `status` 多一层

当前前端、Swagger 说明、文档、skill 全部围绕 `status.code` / `status.message` 编写。每新增一个消费方都要记住多剥一层，且与 `health` 的 `data.status` 字段产生同名歧义。目标是把 `code` / `message` 提升到顶层。

### 4.2 `code` 只是 HTTP 状态码的复制，不是真正的业务码

同一数值承载了不同语义：

| 当前 code | 可能含义                                                 |
| --------- | -------------------------------------------------------- |
| 401       | 未登录/会话过期；登录邮箱或密码错误；`/me` 用户被删除    |
| 400       | DTO 校验失败；`content` 为空；分页锚点无效；上游拒绝请求 |
| 404       | 会话不存在；模型不存在；未知路由                         |
| 500       | 未预期异常；请求体过大                                   |
| 409       | 邮箱已被注册                                             |

前端只能靠 message 文案猜测具体原因，无法稳定分支；文档里的「错误码表」也因此无法唯一标识场景。

### 4.3 4xx 也返回 `stack`

`HttpExceptionFilter` 对任何 `Error` 都返回 `stack`，包括 400/401/404 这类预期错误。影响：

- 响应体变大，4xx 也会带十几行调用栈；
- 暴露后端文件路径、函数名、依赖版本等实现细节；
- 前端 `ApiError.serverStack` 虽然不展示，但仍被传输与保存。

目标：`stack` 只用于未预期异常（§五），且生产环境默认不返回。

### 4.4 body-parser 错误分类不准确

- 非法 JSON：Nest 12 把它转成 `BadRequestException`，code=400，但 message 是英文解析信息，不是用户可读文案。
- 请求体 > 2mb：`PayloadTooLargeError` 不是 `HttpException`，当前落成 500；按语义应该是「请求体过大」。

### 4.5 Prisma 错误没有统一翻译

- 注册的「先查再建」存在并发窗口，唯一约束 `P2002` 会直接冒到过滤器 → 500。
- `P2025`（记录不存在）目前只有 `conversations.service.ts` 手动 catch 成 404；其它 service 依赖先查，竞态下仍可能 500。
- 数据库连接/超时等基础设施错误也统一变成 500，没有更细的分类。

### 4.6 日志与线上状态不一致

`LoggingInterceptor` 异常分支记的是 `error.status`（401/404/500），但实际响应 HTTP 是 200，且日志里没有业务码。结果是：

- 访问日志看不出「HTTP 200 但业务失败」；
- 按 HTTP 状态做的告警完全失效；
- 排查时无法从日志直接定位到 `code`。

### 4.7 全 200 带来的监控盲区

APM、网关、负载均衡默认按 HTTP 状态统计错误率。全 200 会让这些面板显示「零错误」，但业务可能大量失败。必须补：

- 按 `code` 的日志指标（如 `code=10000`、`code=30010` 的数量）；
- 对「5xx 等价」业务码（未预期异常、上游异常）单独告警；
- 前端错误上报里带上 `code`。

### 4.8 健康检查与信封同名

`GET /api/health` 的 `data` 是 `{ status: 'ok', uptime, timestamp, version }`，而信封顶层也叫 `status`。扁平化后同名冲突消失；但健康检查目前只反映进程存活，不检查数据库/上游，不能代表「后端服务正常」。

### 4.9 Swagger 契约不完整

controller 上的 `@ApiOkResponse({ description })` 只描述 `data` 的形状，没有描述信封；Swagger UI 里看到的响应模型与实际返回不一致。外部调用方容易以为顶层就是业务数据。

### 4.10 成功/失败语义没有成文

- 成功 `message` 是空字符串，失败 `message` 是提示文案；
- 失败 `data` 恒为 `null`；
- `stack` 成功为 `[]`、失败为数组；
- `@Res()` / `@SkipResponseEnvelope` 是绕过信封的例外口子，缺少纪律约束。

这些规则目前只存在于代码里，新接口容易写出不一致的结构。

### 4.11 `headersSent` 守卫不完整

过滤器只判断 `response.headersSent`，没有判断 `response.writableEnded` / `response.destroyed`。极端情况下（响应已结束但 headers 标记未置位）仍可能尝试写 JSON，触发 `ERR_STREAM_WRITE_AFTER_END`。

### 4.12 没有集中式业务码注册表

message 散落在各 service，code 由 `HttpException` 状态推导；没有枚举/常量表，无法做「码是否重复」的静态检查，文档与代码容易漂移。

---

## 五、目标契约

### 5.1 扁平信封

```ts
/** 后端统一响应：成功 code=0，失败 code 为业务码 */
export interface ApiSuccess<T> {
  code: 0
  message: ''
  data: T
}

export interface ApiFailure {
  code: number
  message: string
  data: null
  /** 仅未预期异常、且非生产环境时返回；排查用，前端不展示 */
  stack?: string[]
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure
```

成功：

```json
{ "code": 0, "message": "", "data": { "user": { "id": "u_1" } } }
```

业务失败：

```json
{ "code": 10002, "message": "未登录或登录已过期", "data": null }
```

未预期异常（仅非生产环境带 `stack`）：

```json
{
  "code": 10000,
  "message": "服务器内部错误",
  "data": null,
  "stack": ["InternalServerError: ...", "    at ..."]
}
```

### 5.2 字段规则

| 字段      | 类型        | 规则                                                              |
| --------- | ----------- | ----------------------------------------------------------------- |
| `code`    | `number`    | `0` 成功；非 0 失败；只追加不复用；与 HTTP 状态码无关             |
| `message` | `string`    | 成功为 `''`；失败为可直接展示的中文文案；不含堆栈、SQL、密钥      |
| `data`    | `T \| null` | 成功为业务数据（无返回值时为 `null`）；失败恒为 `null`            |
| `stack`   | `string[]?` | 仅未预期异常（`code=10000`）且 `NODE_ENV !== 'production'` 时返回 |

### 5.3 HTTP 200 的边界

| 场景                   | HTTP            | 响应体                        | 说明                                       |
| ---------------------- | --------------- | ----------------------------- | ------------------------------------------ |
| JSON 成功              | 200             | 信封 `code=0`                 | 常规接口                                   |
| JSON 业务失败          | 200             | 信封 `code≠0`                 | 预期错误                                   |
| JSON 未预期异常        | 200             | 信封 `code=10000`             | 进程仍存活                                 |
| SSE 成功               | 200             | `text/event-stream`，无信封   | `POST /api/chat/completions`               |
| SSE 写头前失败         | 200             | JSON 信封                     | 交给全局过滤器                             |
| SSE 写头后失败         | 200             | SSE `backend_stream_error` 帧 | 不再写 JSON                                |
| CORS 预检              | 204             | 空                            | `cors` 中间件默认行为，不属于业务响应      |
| Swagger UI / 静态资源  | 200 / 304 等    | 非信封                        | 文档页面，不属于 JSON API                  |
| 健康检查               | 200             | 信封 `code=0`                 | 进程存活；若加 readiness，允许 503（待定） |
| 未知路由               | 200             | 信封 `code=10004`             | Nest 12 的 404 处理器进入全局过滤器        |
| 非法 JSON              | 200             | 信封 `code=10001`             | message 需归一化为中文（P3）               |
| 请求体 > 2mb           | 200             | 信封 `code=10007`             | 当前是 500，需补映射                       |
| 反向代理 / 网关        | 502 / 503 / 504 | 网关自己的响应                | 不在后端契约内                             |
| 进程未启动 / 连接被拒  | 无响应          | 无                            | 客户端按网络错误处理                       |
| 启动期环境变量校验失败 | 无响应          | 无                            | 进程直接退出                               |

### 5.4 与当前结构的对照

| 当前                                           | 目标                               |
| ---------------------------------------------- | ---------------------------------- |
| `status.code`                                  | `code`（顶层）                     |
| `status.message`                               | `message`（顶层）                  |
| `stack` 必填，成功为 `[]`                      | `stack` 可选，成功不返回           |
| 失败 `data: null`                              | 不变                               |
| HTTP 200                                       | 不变                               |
| 前端 `body.status.code`                        | `body.code`                        |
| 前端 `isApiResponse` 强依赖 `status` + `stack` | 改为 `isApiEnvelope`，`stack` 可选 |

---

## 六、业务码设计

### 6.1 规则

- 类型为 `number`，`0` 表示成功；建议使用整数，不使用字符串。
- 按区间分段，**只追加、不重排、不复用**；废弃的码保留占位。
- `code` 与 HTTP 状态码解耦；HTTP 状态只用于框架层错误分类与内部日志，不直接暴露给前端。
- 预期错误必须在抛错点显式指定业务码；通用兜底码只用于未分类异常。
- 每个码在本文 §6.2 和 Swagger/接口文档中有一行说明。

### 6.2 码表（建议方案）

**通用（`1xxxx`）**

| code    | 含义               |
| ------- | ------------------ |
| `0`     | 成功               |
| `10000` | 未预期异常（兜底） |
| `10001` | 参数 / 校验错误    |
| `10002` | 未登录 / 会话失效  |
| `10003` | 无权限             |
| `10004` | 资源不存在         |
| `10005` | 冲突               |
| `10006` | 限流               |
| `10007` | 请求体过大         |

**认证（`2xxxx`）**

| code    | 含义           |
| ------- | -------------- |
| `20001` | 邮箱或密码错误 |
| `20002` | 邮箱已被注册   |

> `/me` 时用户已被删除继续使用 `10002`（会话失效），message 为 `用户不存在或已被删除`，这样前端只需要把 `10002` 当作「回登录页」的信号。

**对话（`3xxxx`）**

| code    | 含义                                  |
| ------- | ------------------------------------- |
| `30001` | 会话不存在                            |
| `30002` | 模型不存在 / 已下线                   |
| `30003` | 没有可用的模型                        |
| `30004` | `content` 为空                        |
| `30005` | 分页锚点无效                          |
| `30006` | 上游拒绝了请求（上游 400）            |
| `30007` | 上游鉴权失败（上游 401 / 403）        |
| `30008` | 上游地址错误（上游 404）              |
| `30009` | 上游限流（上游 429）                  |
| `30010` | 上游服务异常 / 超时 / 网络错误        |
| `30011` | 上游返回非 SSE 响应                   |
| `30012` | 流中断（**仅 SSE 错误帧**，不进信封） |

**预留**

- `4xxxx`：订单/计费等未来业务域。
- `9xxxx`：系统级保留码（如强制下线、维护中）。
- 未分配的码不要使用，避免未来冲突。

### 6.3 当前码 → 目标码

| 当前场景               | 当前 code | 目标 code |
| ---------------------- | --------- | --------- |
| 未登录 / token 无效    | 401       | `10002`   |
| `/me` 用户被删除       | 401       | `10002`   |
| 登录邮箱或密码错误     | 401       | `20001`   |
| 注册邮箱已存在         | 409       | `20002`   |
| DTO 校验失败           | 400       | `10001`   |
| `content` 为空         | 400       | `30004`   |
| 分页锚点无效           | 400       | `30005`   |
| 上游 400               | 400       | `30006`   |
| 会话不存在             | 404       | `30001`   |
| 模型不存在 / 已下线    | 404       | `30002`   |
| 未知路由               | 404       | `10004`   |
| 上游 401 / 403         | 502       | `30007`   |
| 上游 404               | 502       | `30008`   |
| 上游 5xx / 网络 / 超时 | 502       | `30010`   |
| 上游非 SSE             | 502       | `30011`   |
| 上游 429               | 429       | `30009`   |
| 没有可用模型           | 503       | `30003`   |
| 非法 JSON              | 400       | `10001`   |
| 请求体 > 2mb           | 500       | `10007`   |
| Prisma P2002           | 500       | `10005`   |
| Prisma P2025           | 500 / 404 | `10004`   |
| 未预期异常             | 500       | `10000`   |

### 6.4 映射机制

新增一个携带业务码的异常类型，避免每个 service 手写响应体：

```ts
// apps/backend/src/common/errors/api.exception.ts
export class ApiException extends HttpException {
  constructor(
    readonly code: number,
    message: string,
    httpStatus: number = HttpStatus.BAD_REQUEST,
  ) {
    super(message, httpStatus)
  }
}
```

过滤器解析顺序：

1. `exception instanceof ApiException` → 用 `exception.code`。
2. 否则按 HTTP 状态兜底：`400→10001`、`401→10002`、`403→10003`、`404→10004`、`409→10005`、`413→10007`、`429→10006`、`5xx→10000`。
3. 非 `HttpException` 但有 `status`/`statusCode`（如 body-parser 的 413）→ 按该状态兜底。
4. Prisma `P2002` → `10005`、`P2025` → `10004`。
5. 其余 → `10000`。

抛错点改造示例：

```ts
// 之前
throw new UnauthorizedException('邮箱或密码错误')
// 之后
throw new ApiException(20001, '邮箱或密码错误', 401)
```

```ts
// 之前
throw new NotFoundException('会话不存在')
// 之后
throw new ApiException(30001, '会话不存在', 404)
```

标准 Nest 异常仍可用于通用场景（如 `10001` / `10004`），由兜底表映射；只有需要区分语义的地方才显式指定 `ApiException`。

---

## 七、过滤器 / 拦截器改造设计

### 7.1 `HttpExceptionFilter` 目标行为

```text
catch(exception, host):
  status = exception instanceof HttpException ? exception.getStatus() : undefined
  code   = explicit ApiException.code
           ?? fallback[status]
           ?? fallback[bodyParserStatus]
           ?? prismaMapping(exception)
           ?? 10000
  message = resolveMessage(exception, code)
  stack   = shouldIncludeStack(code) ? splitStack(exception) : undefined

  if response.headersSent || response.writableEnded || response.destroyed:
    log(method, url, code, '响应已开始/已结束，无法写入错误体')
    return

  log(method, url, code, status, duration?)   // 未预期异常记完整 stack
  response.status(200).json({ code, message, data: null, ...(stack ? { stack } : {}) })
```

`resolveMessage` 规则：

- `ApiException` → 自身 message。
- `HttpException`：
  - string → trim 后使用；
  - object `message` 为 string → 使用；
  - object `message` 为 array → 过滤字符串后 `；` 拼接；
  - 空 → `请求失败，请稍后重试`。
- body-parser：
  - 413 → `请求体过大，请精简后重试`；
  - 非法 JSON → `请求体不是合法的 JSON`（P3 归一化）。
- 未知路由 → `接口不存在`（P3 归一化；当前是 `Cannot GET ...`）。
- 非 `HttpException` → `服务器内部错误`。

`shouldIncludeStack`：

- 仅 `code === 10000`；
- 且 `NODE_ENV !== 'production'`；
- 其它情况不输出 `stack` 字段（不是输出空数组）。

### 7.2 `TransformInterceptor` 目标行为

```ts
return { code: 0, message: '', data: data ?? null }
```

- `@SkipResponseEnvelope()` 与 `headersSent` 的短路逻辑保留。
- 成功不再输出 `stack`。
- 无返回值时 `data` 为 `null`（与当前一致）。

### 7.3 SSE 路径

- 保留 `@SkipResponseEnvelope()`；成功流不包信封。
- 写头前失败：继续抛给过滤器，返回扁平 JSON 信封。
- 写头后失败：继续写 `backend_stream_error` 帧；如未来要在帧里带业务码，可增加 `code: 30012`，但当前帧结构不变。
- `headersSent` 守卫仍是过滤器必须保留的分支。

### 7.4 日志

建议统一格式：

```text
POST /api/auth/login http=200 code=20001 12ms
GET /api/chat/models http=200 code=0 5ms
GET /api/unknown http=200 code=10004 1ms
```

- 未预期异常额外输出完整堆栈（仅服务端日志，不返回客户端）。
- 不打印密码、token、apiKey；上游错误只记录状态码与截断后的响应片段（当前 `chat.service` 已这样做）。
- 监控按 `code` 聚合，不再依赖 HTTP 状态。

### 7.5 Swagger

- 保持 `@ApiOkResponse` 描述 `data` 的业务形状。
- 建议在 `main.ts` 的 `DocumentBuilder` 或公共 decorator 里补充信封说明，或在每个接口 description 里注明「响应包在 `{ code, message, data }` 中」。
- P1 至少把所有 `description` 中涉及 `status.code` 的文案改成 `code`。

---

## 八、前端影响与改造

### 8.1 `apps/frontend/src/utils/api.ts`

当前解析：

- `isApiResponse` 要求顶层有 `status` 对象，且 `stack` 是数组；
- 成功判断 `body.status.code !== 0`；
- `ApiError.code` 取 `status.code`；
- 非 200 时如果响应仍是信封，复用 `status.code/message`；
- `request<T>` 返回 `response.data.data`。

目标：

```ts
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
  stack?: string[]
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false
  const { code, message, data } = value as Record<string, unknown>
  return typeof code === 'number' && typeof message === 'string' && 'data' in value
}
```

- 成功：`body.code === 0`，返回 `body.data`。
- 失败：`createApiError({ code: body.code, message: body.message || '请求失败，请稍后重试', stack: body.stack ?? [] })`。
- `stack` 可能缺席，`ApiError.serverStack` 默认 `[]`。
- 非 200（代理/网关）：若响应体是信封，优先用其 `code` / `message`；否则按 HTTP 状态 fallback。
- `silent` / `skipAuthRedirect` / `onUnauthorized` 机制不变。

### 8.2 会话失效判定

P1（`code` 仍沿用 HTTP 数值）阶段：

- `ApiError.code === 401` → 触发 `onUnauthorized`。
- 登录/注册/登出/`/me` 继续传 `skipAuthRedirect: true`。

P2（业务码）阶段：

- 会话失效统一用 `10002` 判定；
- 登录密码错误是 `20001`，**不能**触发跳登录；
- `SessionProvider` 的注释、`onUnauthorized` 的说明同步改为 `code=10002`。

### 8.3 调用点清单

| 位置                              | 接口                                        | 备注                          |
| --------------------------------- | ------------------------------------------- | ----------------------------- |
| `provider/session-provider.tsx`   | `GET /api/auth/me`、`POST /api/auth/logout` | `silent` + `skipAuthRedirect` |
| `app/auth/login/page.tsx`         | `POST /api/auth/login`                      | 失败只 toast，不跳登录        |
| `app/auth/register/page.tsx`      | `POST /api/auth/register`                   | 同上                          |
| `components/settings/api.ts`      | `/api/chat/models*`                         | 设置页模型配置                |
| SSE（独立封装，不在 `api.ts` 内） | `POST /api/chat/completions`                | 不解析信封                    |

---

## 九、迁移方案

### 9.1 阶段总览

| 阶段 | 目标                                           | 风险 | 可独立发布     |
| ---- | ---------------------------------------------- | ---- | -------------- |
| P0   | 本文档 + 索引，冻结契约                        | 无   | 是             |
| P1   | 去掉 `status` 层，`code` 暂沿用 HTTP 数值      | 中   | 前后端需同发布 |
| P2   | 引入业务码表与 `ApiException`                  | 中高 | 前后端需同发布 |
| P3   | 健壮性：body-parser/Prisma/stack/日志/健康检查 | 低   | 是             |

### 9.2 P1：拆壳（行为唯一变化是去掉 `status`）

后端：

- `apps/backend/src/common/types/api-response.ts`
  - 改为 `ApiEnvelope<T>` / `ApiSuccess<T>` / `ApiFailure`。
- `apps/backend/src/common/interceptors/transform.interceptor.ts`
  - 返回 `{ code: 0, message: '', data: data ?? null }`。
- `apps/backend/src/common/filters/http-exception.filter.ts`
  - body 改为 `{ code, message, data: null, stack }`；
  - `code` 仍取 `HttpException.getStatus()` / 500（P2 再改业务码）；
  - 保留 `headersSent` 守卫与未知异常日志。
- 同步修改文件头注释中的信封示例。

前端：

- `apps/frontend/src/utils/api.ts`
  - `ApiResponse` / `isApiResponse` → `ApiEnvelope` / `isApiEnvelope`；
  - 读取 `body.code` / `body.message`；
  - `stack` 允许缺席；
  - `ApiError` 对外字段不变。
- `apps/frontend/src/provider/session-provider.tsx`
  - 仅改注释；`ApiError.code === 401` 逻辑不变。

文档 / skill：

- `AGENTS.md` 第 69 行的事实描述、第 71 行的 `status.code=401`。
- `docs/auth.md` §4、§4.6、§7、§十 验收标准。
- `docs/chat.md` §4、§4.5、§六 的错误码说明。
- `docs/coding-conventions.md` §四。
- `docs/monorepo.md` §19.3。
- `.agent/skills/nestjs-api-contract/SKILL.md`、`nestjs-error-handling/SKILL.md`。

验收：

- `grep -R "status: { code" apps/backend/src apps/frontend/src` 无残留（注释除外）。
- 成功/失败 curl 返回扁平结构。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`。

回滚：前后端同一提交内 revert；若后端先发、前端后发，使用 §9.5 的双写窗口。

### 9.3 P2：业务码

后端：

- 新增 `apps/backend/src/common/errors/api-code.ts`（常量/枚举）与 `api.exception.ts`。
- `http-exception.filter.ts` 增加 `ApiException` 解析与 HTTP 兜底映射、Prisma/body-parser 映射。
- 改造抛错点：
  - `auth/auth.service.ts`：`20001`、`20002`；`profile` 用 `10002`。
  - `auth/jwt-auth.guard.ts`：`10002`。
  - `chat/chat.service.ts`：`30004`、`30006`–`30011`。
  - `chat/conversations.service.ts`：`30001`、`30005`。
  - `chat/models.service.ts`：`30002`、`30003`。
  - `chat/chat.controller.ts`：SSE 帧如需带码，加 `30012`。
- 更新 §3.2 / §6.2 / §6.3 对应的文档表格。

前端：

- `session-provider.tsx` 与 `api.ts` 注释：会话失效改判 `10002`。
- 登录/注册页面继续 `skipAuthRedirect: true`，`20001` 只 toast。

验收：

- 错误码表逐项 curl 验证（见 §10.2）。
- 前端登录密码错误不跳登录；无 cookie 的 `/me` 跳登录。
- `pnpm lint` / `pnpm typecheck` / `pnpm build`。

### 9.4 P3：健壮性与收尾

- body-parser：`413` → `10007`；非法 JSON message 归一化为中文。
- Prisma：`P2002` → `10005`、`P2025` → `10004`；连接/超时归入 `10000`。
- `stack` 生产环境关闭；仅 `10000` 且非生产返回。
- `LoggingInterceptor` 输出 `http=200 code=...`；未知异常单独记录 stack。
- `HttpExceptionFilter` 增加 `writableEnded` / `destroyed` 判断。
- 健康检查：评估是否拆 `/api/health`（liveness，恒 200）与 `/api/health/ready`（readiness，DB 不可用时 503）；若保留单端点，保持 200 + `data.status`。
- Swagger：补充信封说明或统一 response schema。
- 404 文案归一化（`接口不存在`）。

### 9.5 兼容方案 B：双写窗口（仅当前后端独立发布时）

后端一个版本同时输出新旧字段：

```json
{
  "code": 0,
  "message": "",
  "data": {},
  "stack": [],
  "status": { "code": 0, "message": "" }
}
```

前端过渡解析：

```ts
const code = body.code ?? body.status?.code
const message = body.message ?? body.status?.message ?? '请求失败，请稍后重试'
```

下一版本删除 `status`。成本是双份字段、文档要同时展示两种结构、容易漏改；能原子发布时不要采用。

### 9.6 回滚点

- P1：前后端同提交 revert；双写窗口下前端可先回退解析逻辑。
- P2：业务码是纯响应体变更，回退 P2 提交即可；前端 `10002` 判定需同步回退到 401。
- P3：逐项独立，可按项 revert。

---

## 十、验收清单

### 10.1 文档验收

- 现状结论能逐条对应到文件/函数；无臆测。
- 目标契约含类型、JSON 示例、HTTP 边界表。
- 业务码表覆盖所有现有抛错点与已知缺口（body-parser/Prisma/404/SSE）。
- 迁移步骤列出受影响文件、验收命令、回滚点。
- `AGENTS.md` 索引已加入本文。

### 10.2 实现验收（已执行，仓库无自动化测试）

> 2026-11 实施后已用本地 HTTP 冒烟覆盖：第 1、7、8、9 项、业务码解析（P2002→10005、P2025→10004、413→10007）、
> `stack` 仅在 `10000` 且非生产返回、`ApiException` 无 `stack`、DTO 数组「；」拼接，共 16 项断言全部通过。
> 第 2–6、10–17 项涉及数据库 / 上游 / 浏览器，需在完整环境（Postgres + 前端）按表复核。

| #   | 请求 / 场景                             | 期望                                                            |
| --- | --------------------------------------- | --------------------------------------------------------------- |
| 1   | `GET /api/health`                       | 200，`{ code:0, message:"", data:{ status:"ok", ... } }`        |
| 2   | `POST /api/auth/login` 正确凭证         | 200，`code=0`，`data.user`，`Set-Cookie`                        |
| 3   | `POST /api/auth/login` 错误密码         | 200，`code=20001`，`message=邮箱或密码错误`，无 `stack`（生产） |
| 4   | `GET /api/auth/me` 无 cookie            | 200，`code=10002`，`message=未登录或登录已过期`                 |
| 5   | `POST /api/auth/register` 重复邮箱      | 200，`code=20002`                                               |
| 6   | `POST /api/auth/register` 非法 DTO      | 200，`code=10001`，message 为「；」拼接的校验文案               |
| 7   | `GET /api/unknown`                      | 200，`code=10004`                                               |
| 8   | `POST` 非法 JSON                        | 200，`code=10001`，message 为中文「请求体不是合法的 JSON」      |
| 9   | `POST` >2mb JSON                        | 200，`code=10007`                                               |
| 10  | `POST /api/chat/completions` 无可用模型 | 200，`code=30003`                                               |
| 11  | 上游 401                                | 200，`code=30007`，message 指向 apiKey                          |
| 12  | SSE 成功                                | 200，`text/event-stream`，无信封，`data: [DONE]`                |
| 13  | SSE 写头前失败                          | 200，JSON 信封                                                  |
| 14  | SSE 写头后失败                          | 200，`backend_stream_error` 帧 + `[DONE]`                       |
| 15  | 前端：无 cookie 打开受保护页            | `/me` 返回 `10002` 后跳 `/auth/login?callbackUrl=...`           |
| 16  | 前端：登录密码错误                      | 只 toast，不跳登录                                              |
| 17  | 日志                                    | `http=200 code=...`；未预期异常有服务端 stack                   |

命令：

```bash
pnpm lint
pnpm typecheck
pnpm build
```

仓库没有 `test` 脚本，禁止引入 vitest / jest / supertest 或 `*.spec.ts`。

### 10.3 回归检查

- 所有 `@ApiOkResponse` 的 description 不再出现 `status.code`。
- 前端 `grep -R "body.status"` 无残留。
- `@SkipResponseEnvelope` 仅用于 SSE/流式接口。
- 新增接口不再手写响应体，统一返回业务数据。

---

## 十一、风险与待确认

### 11.1 全 200 的监控代价

- APM/网关看不到 4xx/5xx 错误率；必须按 `code` 建日志指标与告警。
- 建议对 `10000`（未预期异常）、`30010` / `30011`（上游异常）单独告警。
- 前端错误上报带上 `code` 与接口路径，便于关联。
- GET 的错误响应理论上有被中间缓存的风险；如需，可对 API 响应加 `Cache-Control: no-store`（当前未设置，列为待评估）。

### 11.2 待确认

| 事项                         | 选项 / 建议                                              |
| ---------------------------- | -------------------------------------------------------- |
| 业务码表是否按 §6.2 落地     | 建议按区间；若团队希望先最小改动，可只做 P1，P2 另行评审 |
| P1 与 P2 是否合并            | 建议分开，避免同时改变结构与码值                         |
| `stack` 生产环境是否完全关闭 | 建议关闭，仅非生产返回                                   |
| 健康检查是否拆 readiness     | 建议后续拆；本次保持单端点 200                           |
| 是否接受双写兼容窗口         | 仅前后端独立发布时需要                                   |
| 非法 JSON 是否单独业务码     | 当前归入 `10001`；如需 `10008` 再评审                    |

### 11.3 明确不做

- 不把 HTTP 状态码改回 4xx/5xx（项目约定优先）。
- 不为所有异常引入 Nest 内置过滤器链（保持单一 `HttpExceptionFilter`）。
- 不引入新的测试框架。
- 不修改 SSE 成功帧格式、cookie、路由与数据库 schema。

---

## 十二、相关文档与后续同步

实施 P1/P2 时，以下位置需要同步修改，避免文档与代码漂移：

| 文档 / 文件                                    | 需要更新的内容                                                  | 时机  |
| ---------------------------------------------- | --------------------------------------------------------------- | ----- |
| `AGENTS.md` §四                                | 第 69 行响应结构、第 71 行 `status.code=401`                    | P1/P2 |
| `docs/auth.md`                                 | §4 响应示例、§4.6 错误码表、§7 前端解析、验收表                 | P1/P2 |
| `docs/chat.md`                                 | §4 响应结构、§4.5 错误码表、§六 上游错误说明                    | P1/P2 |
| `docs/coding-conventions.md`                   | §四「成功判断看 status.code」                                   | P1    |
| `docs/monorepo.md` §19.3                       | 响应结构与全局注册说明                                          | P1    |
| `docs/directory-structure.md`                  | 第 162 行「错误统一走 `HttpExceptionFilter`」保持不变，无需改动 | —     |
| `.agent/skills/nestjs-api-contract/SKILL.md`   | 统一响应信封、HTTP 200、错误码示例                              | P1/P2 |
| `.agent/skills/nestjs-error-handling/SKILL.md` | 过滤器输出、stack 策略、日志格式                                | P1/P2 |
| `apps/frontend/src/utils/api.ts` 注释          | `{ status, data, stack }` → 扁平结构                            | P1    |
| `apps/backend/src/common/**` 文件头注释        | 信封示例                                                        | P1    |

---

## 十三、实施状态（2026-11）

### 13.1 阶段完成情况

| 阶段 | 内容                                                                                                        | 状态   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------ |
| P1   | 扁平信封 `{ code, message, data, stack? }`；成功不输出 `stack`                                              | 已完成 |
| P2   | `ApiCode` 码表 + `ApiException`；所有抛错点改用业务码                                                       | 已完成 |
| P3   | 413 / 非法 JSON / 未知路由归一化；Prisma P2002·P2025；`stack` 生产关闭；`writableEnded` 守卫；日志带 `code` | 已完成 |

> P1 与 P2 在同一提交内合并实施：前后端同仓库原子发布，跳过了中间态（`code` 仍为 HTTP 数值）与 §9.5 双写窗口。

### 13.2 代码落点

| 能力                   | 文件                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| 业务码表               | `apps/backend/src/common/errors/api-code.ts`                          |
| 业务异常               | `apps/backend/src/common/errors/api.exception.ts`                     |
| 码 / 文案 / stack 解析 | `apps/backend/src/common/errors/api-error.ts`                         |
| 信封类型               | `apps/backend/src/common/types/api-response.ts`                       |
| 成功包装               | `common/interceptors/transform.interceptor.ts`                        |
| 失败包装               | `common/filters/http-exception.filter.ts`                             |
| 访问日志               | `common/interceptors/logging.interceptor.ts`                          |
| 抛错点                 | `auth/auth.service.ts`、`auth/jwt-auth.guard.ts`、`chat/*.service.ts` |
| 前端解析               | `apps/frontend/src/utils/api.ts`（`API_CODE` / `isApiEnvelope`）      |

### 13.3 明确未做（按 §9.4 / §11.2 定为后续或待定）

- 健康检查未拆 readiness 端点，保持单端点 200 + `data.status`。
- SSE 错误帧结构未变，未在帧里加 `code: 30012`。
- 未接入按 `code` 的监控 / 告警指标（属部署侧配置）。
- 未采用 §9.5 双写窗口。

---

## 附：一句话总结

后端保持「JSON 接口 HTTP 恒 200」，响应体已扁平为 `{ code, message, data, stack? }`：`code` 是项目自定义业务码（`0` 成功，`1xxxx` 通用 / `2xxxx` 认证 / `3xxxx` 对话），`stack` 只在未预期异常的非生产环境出现；前端、Swagger、文档与 skill 已同步到该契约。
