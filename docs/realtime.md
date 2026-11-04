# WebSocket 会话踢下线方案与架构评估

## 一、结论：方向符合，但不能“只加 WebSocket”

结论：**“登录后建立 WebSocket，被踢时推送通知，前端跳登录页”这个交互符合当前架构；但如果只实现 WebSocket 通知，在当前代码状态下是“假踢”。**

原因：

- 当前会话是无状态 JWT（[token.service.ts](../apps/backend/src/auth/token.service.ts)），后端没有 Session 表、没有吊销机制；踢人后旧 cookie 在 7 天内仍然能调用 `/api/*`。
- [middleware.ts](../apps/frontend/src/middleware.ts) 只判断 cookie 是否存在，无法在 Edge/构建期验签；真正的鉴权在后端 [jwt-auth.guard.ts](../apps/backend/src/auth/jwt-auth.guard.ts)。
- 因此必须补上**服务端会话吊销**（`User.tokenVersion`），WebSocket 只是“即时通知加速器”，最终判定仍以后端守卫为准。

### 符合架构的部分

- 前端已有 [session-provider.tsx](../apps/frontend/src/provider/session-provider.tsx)，把实时连接挂在 Provider 层，符合 `UI → Provider/Hook → Service → API` 分层。
- 浏览器直连 Nest（`NEXT_PUBLIC_API_URL`）是现有模式，WebSocket 直连后端不引入 Next 服务端中转，边界清晰。
- cookie 为 httpOnly + 同站部署，WebSocket 握手可复用同一份 cookie/JWT，不需要第二套 token。
- 后端新增 `src/realtime/` 模块符合 Nest 模块化约定；不引入 socket.io，前端零新增依赖。

### 必须补齐的部分

1. **会话吊销**：`User.tokenVersion` + JWT `ver` claim，守卫每次比对。
2. **WebSocket 鉴权**：升级请求不走 Express 中间件，需手动解析 cookie、验 JWT、查版本、校验 Origin。
3. **踢人接口**：当前没有管理员踢人入口，需要新增仅 `ADMIN` 可调的接口。
4. **前端连接生命周期**：只在已登录且非登录/注册页连接；踢下线后停止重连、清 cookie、跳登录页。
5. **部署约束**：单实例内存 registry；反向代理需支持 Upgrade；生产必须 `wss`。
6. **全局守卫上下文**：全局 `JwtAuthGuard` 也会作用于 WebSocket 消息处理器，需要避免它把 WS 上下文当 HTTP 请求处理。

> 备选：如果只做单向通知，SSE 比 WebSocket 更轻（项目已有 SSE 聊天）。本次按你的选择使用原生 WebSocket，以上结论不受影响。

---

## 二、目标与成功标准

目标：

1. 已登录用户访问受保护页面时建立 **每标签页一条** WebSocket 连接；登录/注册页不建立。
2. 管理员通过接口踢指定用户后，该用户所有在线标签页/设备立即收到 `session.kicked`。
3. 前端收到通知后：提示原因 → 调用登出清 cookie → 跳转 `/auth/login`。
4. 被踢用户的旧 JWT 立即失效：后续 `/api/auth/me` 与所有受保护接口返回 401。
5. 用户离线/通知丢失时，重新打开页面仍会被 `/me` 401 拦回登录页。
6. 不破坏现有登录、登出、聊天 SSE、设置弹窗流程。

成功标准：

- 握手成功时 DevTools 显示 `101 Switching Protocols`，路径 `/api/ws`。
- 踢人接口返回 200 后，在线标签页 1 秒内收到通知并跳转。
- 旧 cookie 调 `/api/auth/me` 返回 401，而不是继续可用。
- 被踢后客户端不再自动重连。
- `pnpm lint` / `pnpm typecheck` / `pnpm build` 全绿。

---

## 三、总体设计

```text
管理员
  │ POST /api/admin/users/:id/kick
  ▼
Nest JwtAuthGuard（全局）→ RolesGuard（ADMIN）
  │
  ├─ AuthService.revokeSessions(userId)     // User.tokenVersion += 1
  └─ SessionRegistry.publishKick(userId)    // 推送 session.kicked + close(4001)
           │
           ▼
被踢用户标签页 WebSocket
  │ onmessage session.kicked / onclose 4001
  ├─ toast 提示
  ├─ POST /api/auth/logout（清 cookie）
  └─ router.replace('/auth/login')

之后任意 HTTP 请求：
  JwtAuthGuard → 比对 token.ver 与 DB tokenVersion → 不一致 → 401
```

### 3.1 会话吊销模型

- Prisma `User` 新增 `tokenVersion Int @default(0)`。
- JWT 新增 claim `ver`（当前 tokenVersion）。
- 守卫验签后调用 `AuthService.isSessionActive(userId, ver)`：
  - 用户不存在 → false；
  - `user.tokenVersion !== ver` → false；
  - 否则放行。
- 旧 token 没有 `ver` 时按 `0` 处理。现有用户默认值也是 `0`，因此**部署时不会强制所有人重新登录**。
- 踢人 = `tokenVersion += 1`，吊销该用户全部会话（所有设备/标签页）。本轮不做按设备精确踢人。

### 3.2 WebSocket 通道

- 技术选型：Nest `@nestjs/platform-ws` + Node `ws`，前端使用浏览器原生 `WebSocket`。
- 路径：`/api/ws`（Nest 全局前缀不影响 WS，由 Gateway 的 `path` 显式指定）。
- 只做服务端推送，不定义 `@SubscribeMessage`；客户端不需要发送业务消息。
- 握手鉴权流程：
  1. 校验 `Origin` 是否在 `CORS_ORIGINS` 中（浏览器 WS 不受 CORS 保护，必须显式校验）；缺失 Origin 的非浏览器客户端放行。
  2. 从 `request.headers.cookie` 手动读取 `AUTH_COOKIE_NAME`（Express `cookieParser` 不处理 upgrade 请求）。
  3. `TokenService.verify` 验签。
  4. `AuthService.isSessionActive` 查 DB 版本。
  5. 通过后登记 `userId → WebSocket`；失败则 `close(4001, 'unauthorized')`，而不是返回 HTTP 401，保证浏览器能读到关闭码。
- 连接保活：服务端每 30 秒 `ping`，浏览器自动 `pong`；无响应则 `terminate` 并清理。
- token 到期：握手时按 `exp` 设置定时器，到期 `close(4002, 'expired')`。
- 服务端重启/网络断开：客户端指数退避重连，重连时重新走完上述鉴权。

### 3.3 事件与关闭码协议

事件：

```json
{
  "type": "session.kicked",
  "reason": "kicked_by_admin",
  "at": "2026-11-02T13:00:00.000Z"
}
```

`reason` 预留 `kicked_by_admin` / `signed_in_elsewhere`，本次只产生前者。

关闭码：

| code | reason                    | 含义               | 前端行为                 |
| ---- | ------------------------- | ------------------ | ------------------------ |
| 4001 | `kicked` / `unauthorized` | 被踢或握手鉴权失败 | 提示并登出跳登录         |
| 4002 | `expired`                 | token 到期         | 提示登录过期并跳登录     |
| 1008 | `origin`                  | Origin 不在白名单  | 停止重连，仅记录配置错误 |
| 1011 | `server_error`            | 握手期间服务端异常 | 退避重连                 |
| 1006 | —                         | 网络/服务重启      | 退避重连                 |

---

## 四、后端改动

### 4.1 依赖与数据库

- [apps/backend/package.json](../apps/backend/package.json) 新增：
  - `dependencies`: `@nestjs/websockets`、`@nestjs/platform-ws`、`ws`
  - `devDependencies`: `@types/ws`
  - 版本与现有 Nest 12 对齐（`^12.0.1`），执行 `pnpm install` 更新 `pnpm-lock.yaml`。
- [schema.prisma](../apps/backend/prisma/schema.prisma) 的 `User` 增加：

```prisma
tokenVersion Int @default(0)
```

- 执行 `pnpm db:push` 同步数据库，执行 `pnpm generate` 重新生成 Prisma Client（`src/generated/prisma` 为生成物，不手改）。

### 4.2 认证与吊销

- [token.service.ts](../apps/backend/src/auth/token.service.ts)
  - `sign(user, tokenVersion)` 增加 `ver` claim。
  - `verify` 返回 `ver` 与 `exp`；缺失 `exp` 或 `ver` 非法时返回 `null`。
- [auth.service.ts](../apps/backend/src/auth/auth.service.ts)
  - `verifyCredentials` 改为返回 `{ user, tokenVersion }`，避免把 `tokenVersion` 暴露到 `/me` 响应。
  - 新增 `revokeSessions(userId): Promise<boolean>`：`updateMany` 递增 `tokenVersion`，返回用户是否存在。
  - 新增 `isSessionActive(userId, tokenVersion): Promise<boolean>`：只查询 `tokenVersion`。
- [auth.controller.ts](../apps/backend/src/auth/auth.controller.ts)
  - 登录时解构 `{ user, tokenVersion }`，用 `tokenVersion` 签发 token，响应形状保持不变。
- [jwt-auth.guard.ts](../apps/backend/src/auth/jwt-auth.guard.ts)
  - 验签后增加 `isSessionActive` 校验；失效返回 401，消息 `登录状态已失效，请重新登录`。
  - 在 `switchToHttp()` 前增加 `context.getType() !== 'http'` 判断：WS 消息处理器直接放行（握手阶段已鉴权；本轮网关无消息处理器）。注释明确：未来新增 `@SubscribeMessage` 时必须使用专门的 WS 守卫。
- 新增 `apps/backend/src/auth/roles.decorator.ts` 与 `roles.guard.ts`：
  - `@Roles('ADMIN')` + `RolesGuard` 读取 `request.user.role`，非管理员抛 403。

> 代价：每个受保护 HTTP 请求多一次按主键查询。当前规模可接受；后续可做短 TTL 缓存或把版本检查下沉到 Session 表。

### 4.3 实时模块

新增 `apps/backend/src/realtime/`：

| 文件                          | 职责                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `realtime.module.ts`          | imports `AuthModule`；提供 Gateway、Registry、AdminService；注册 AdminController                                               |
| `session.gateway.ts`          | `@WebSocketGateway({ path: '/api/ws' })`；`handleConnection` 做 Origin/cookie/JWT/版本校验；`handleDisconnect` 清理            |
| `session-registry.service.ts` | 内存 `Map<WebSocket, { userId, alive }>` + `Map<userId, Set<WebSocket>>`；push、关闭、心跳、到期定时器、`onModuleDestroy` 清理 |
| `session-admin.service.ts`    | 先 `revokeSessions`，再 `publishKick`；记录审计日志（操作者、目标用户、连接数）                                                |
| `session-admin.controller.ts` | `POST /api/admin/users/:id/kick`，`@UseGuards(RolesGuard)` + `@Roles('ADMIN')`                                                 |
| `session-events.ts`           | 事件类型、`SessionKickReason` 枚举、WS 关闭码常量                                                                              |
| `dto/kick-user.dto.ts`        | 可选 `reason`，`@IsEnum` 校验                                                                                                  |
| `ws-request.ts`               | 手动解析 cookie、Origin 白名单判断                                                                                             |

关键实现约束：

- `publishKick` 先 `send` 再在回调里 `close(4001, 'kicked')`；对已经关闭的 socket 跳过，异常只记录不阻断接口。
- 迭代 socket 集合前复制一份，避免 close 回调修改集合导致漏发。
- 握手异常统一 catch 后 `close(1011)`，避免 async `handleConnection` 的 rejection 逃逸。
- 不在日志中输出 cookie、token。

### 4.4 管理接口契约

```http
POST /api/admin/users/:id/kick
Content-Type: application/json

{ "reason": "kicked_by_admin" }   // 可选
```

| 状态码 | 场景            | 响应                                    |
| ------ | --------------- | --------------------------------------- |
| 200    | 成功            | `{ "success": true, "connections": 2 }` |
| 401    | 未登录/会话失效 | 统一 401 结构                           |
| 403    | 非 ADMIN        | 统一 403 结构                           |
| 404    | 用户不存在      | 统一 404 结构                           |

- 踢自己允许（管理员自己的页面也会被踢）。
- 重复调用幂等：继续递增版本，连接数可能为 0。

### 4.5 启动接线

- [main.ts](../apps/backend/src/main.ts)
  - `app.useWebSocketAdapter(new WsAdapter(app))`，必须在 `listen` 前。
  - 抽出 `parseCorsOrigins()`（新增 `apps/backend/src/common/config/cors.ts`）供 HTTP CORS 与 Gateway Origin 校验共用。
- [app.module.ts](../apps/backend/src/app.module.ts) 增加 `RealtimeModule`。
- 无需修改 `setGlobalPrefix('api')`；WS 路径由 Gateway 自己声明。

---

## 五、前端改动

### 5.1 URL 工具

[apps/frontend/src/utils/api.ts](../apps/frontend/src/utils/api.ts) 增加：

```ts
export function wsUrl(path = '/api/ws') {
  const base = API_BASE_URL.replace(/\/$/, '').replace(/^http/, 'ws')
  return `${base}${path}`
}
```

`http → ws`、`https → wss`。不新增必填环境变量，沿用 `NEXT_PUBLIC_API_URL`。

### 5.2 连接服务

新增 `apps/frontend/src/services/session-events.ts`：

- `SessionEventsClient`，不依赖 React。
- 方法：`connect()`、`disconnect()`；构造参数为 `url` 和 `{ onKicked, onSessionInvalid }`。
- 行为：
  - `onopen` 重置退避计数。
  - `onmessage` 解析 JSON，`type === 'session.kicked'` 时回调并停止重连。
  - `onclose`：4001 → 会话失效；4002 → 过期；1008 → 停止并记录配置错误；其他 → 1s/2s/4s…最大 30s 的指数退避（带抖动）。
  - `online` 事件触发立即重连。
  - `disconnect()` 设置停止标志并关闭 socket，避免组件卸载后重连。
- 仅 client 侧调用，文件 JSDoc 标注。

### 5.3 Provider 接入

新增 `apps/frontend/src/provider/session-events.tsx`：

- `'use client'`，内部调用 `useSession()` 与 `usePathname()`。
- 仅当 `status === 'authenticated'` 且当前不是 `/auth/login`、`/auth/register` 时建立连接。
- 依赖使用 `[status, isPublic]`，**不要依赖整个 pathname**，避免每次路由切换都断开重连。
- 收到踢下线/会话失效：
  1. 用 `ref` 去重（事件和 close 可能同时到）；
  2. `toast.error(...)`（Toaster 在根布局，跳转后仍可见）；
  3. 调用现有 `logout()`：POST `/api/auth/logout` 清 cookie、置为未登录、`router.replace('/auth/login')`。
- 重新登录后（status 再次变 authenticated）重置去重标记。
- 从 [session-provider.tsx](../apps/frontend/src/provider/session-provider.tsx) 导出 `PUBLIC_PATHS` 复用，避免两处维护。

[apps/frontend/src/app/layout.tsx](../apps/frontend/src/app/layout.tsx)：

```tsx
<SessionProvider>
  <SessionEvents />
  {children}
</SessionProvider>
```

不新增 UI 组件，不改 Header/Avatar；踢下线提示复用 `sonner`。

---

## 六、配置、部署与文档

- 不新增必填环境变量；`CORS_ORIGINS` 同时作为 WS Origin 白名单，需包含前端实际 Origin（如 `http://localhost:3000`）。
- 生产要求：
  - HTTPS 页面必须连 `wss://`，否则 `Secure` cookie 不会带上，握手返回 4001。
  - 前后端必须同站（现有 auth 文档已要求）；`127.0.0.1` 与 `localhost` 混用会导致 cookie/WS 鉴权失败。
  - 反向代理需支持 WebSocket Upgrade：`proxy_http_version 1.1`、`Upgrade`/`Connection` 头、足够的 `proxy_read_timeout`；仓库当前没有 Nginx 配置，只在文档中说明。
- 当前 `docker-compose.yml` 是单后端实例，内存 registry 足够；多实例时踢人请求只通知本实例上的连接（token 吊销仍全局生效），后续需 Redis pub/sub 或 Postgres LISTEN/NOTIFY。
- 文档：
  - 本文档（`docs/realtime.md`）：架构图、事件协议、关闭码、踢人接口、代理/同站约束、单实例限制、验证步骤；实施时按需补充实现细节。
  - 更新 [auth.md](./auth.md)：`ver` claim、会话吊销、`/api/admin/users/:id/kick`、401 文案；把“会话吊销”从后续项移到已实现。
  - 更新 [AGENTS.md](../AGENTS.md)：文档索引与“当前项目事实”增加 WebSocket/踢下线。
  - 更新 [directory-structure.md](./directory-structure.md)：`apps/backend/src/realtime`、`apps/frontend/src/services`、`provider/session-events.tsx`。
  - 更新 [tech-stack.md](./tech-stack.md) 与 [README.md](../README.md) 的认证/实时能力说明。

---

## 七、边界与失败模式

| 场景                  | 行为                                                          |
| --------------------- | ------------------------------------------------------------- |
| 用户开多个标签页/设备 | 每个标签页一条连接；踢人时全部收到并跳转                      |
| 踢人时用户离线        | 收不到推送；tokenVersion 已递增，下次 `/me` 返回 401 并跳登录 |
| 通知丢失但 close 到达 | 按 close code 4001 兜底跳转                                   |
| 服务端重启            | 客户端 1006 后退避重连；重连重新鉴权                          |
| 连接空闲被代理断开    | 服务端 30s ping/pong + 客户端重连                             |
| token 在连接期间到期  | 服务端 4002，客户端清 cookie 跳登录                           |
| 被踢后仍快速重连      | 客户端进入 stopped 状态，不再重连；即使重连，握手会 4001      |
| Origin 未配置         | 1008，停止重连并记录配置错误（不跳登录，避免误伤）            |
| 多实例部署            | 仅本实例 socket 收到推送；HTTP 已全局失效。文档标注限制       |
| 管理员踢自己          | 允许，管理员页面同样跳登录                                    |
| 被踢用户正在流式对话  | 前端跳转导致请求中断；已有 SSE 收尾逻辑按 aborted 处理        |

---

## 八、验收步骤

1. `pnpm install`、`pnpm db:push`、`pnpm generate`。
2. `pnpm lint`、`pnpm typecheck`、`pnpm build` 全绿。
3. 启动 `pnpm dev`，用普通用户登录受保护页面：
   - DevTools Network → WS 显示 `/api/ws` 101；
   - 切换 `/home` → `/workflow` 不重建连接；
   - 退出登录后连接关闭；
   - 未登录访问登录页不建立连接。
4. 用 `pnpm db:studio` 将一个用户 `role` 改为 `ADMIN`，重新登录后：
   - `POST /api/admin/users/<targetId>/kick` 返回 200；
   - target 所有标签页立即 toast 并跳转 `/auth/login`；
   - target 旧 cookie 请求 `/api/auth/me` 返回 401；
   - 非管理员调用返回 403；未登录返回 401；不存在用户返回 404。
5. target 关闭所有页面后再踢，重新访问 `/home`：middleware 放行后 SessionProvider 因 `/me` 401 跳登录。
6. 浏览器控制台无 cookie 连接 `ws://localhost:3001/api/ws`，确认 close code 为 4001；用错误 Origin 确认 1008。
7. 重启后端，确认前端自动重连且踢人能力恢复。
8. 回归登录、注册、设置弹窗、聊天 SSE。

> 仓库无自动化测试框架，按 AGENTS 约定不新增 vitest/jest/supertest 或 `*.spec.ts`，以上为手工验收清单。

---

## 九、假设与非目标

假设：

- 只支持单后端实例（与当前 compose 一致）。
- 前后端同站部署；生产使用 HTTPS/WSS。
- 管理员角色已存在并可分配（当前 `User.role`）。
- 踢下线语义是“吊销该用户全部会话”，不区分设备。

本轮不做：

- 管理后台踢人 UI（仅提供 Swagger/API）。
- 按设备/会话精确踢人（需要 Session 表或 sessionId）。
- 新登录挤掉旧会话（可复用同一 `revokeSessions + publishKick`，但不在本轮）。
- Redis/多实例广播。
- 账号禁用、密码修改等其他吊销触发点。
- 引入 socket.io、测试框架或新前端依赖。
- 修改 `middleware.ts` 的粗粒度拦截逻辑。
