# 登录认证改造（NextAuth → Nest 托管）

> 需求与实现说明：把认证从 `next-auth` 收敛到 NestJS，前端只保留"会话状态展示"这一层。

---

## 一、背景与目标

### 1.1 改造前的问题

| 问题                 | 说明                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 后端无法识别用户     | `next-auth` 签发的会话是它自己的加密 cookie，只有 Next 能解；Nest 侧拿不到任何可验证凭据，所有 `/api/*` 处于"裸奔"状态 |
| 登录端点被架空       | `POST /api/auth/verify-credentials` 只是给 NextAuth 的 `authorize()` 调用用的公开接口，本身不做会话管理                |
| 两套身份系统         | 用户数据在 Postgres、会话在 Next 的 JWT cookie，两边各管一半，角色/权限变更无法即时生效                                |
| 依赖 beta 且反向耦合 | `next-auth@5.0.0-beta.29` 跟着 Next 大版本走；如果让 Nest 去解它的 JWT，就要在后端引入 Next 生态                       |

### 1.2 目标

1. **认证收敛到 Nest**：登录、登出、当前用户都由后端提供。
2. **单一凭据**：浏览器只持有一个 `HttpOnly` 会话 cookie，JS 读不到 token。
3. **默认安全**：后端所有接口默认需要登录，公开路由必须显式声明。
4. **前端轻量**：删除 `next-auth` 依赖与相关路由，用一个约 100 行的 `SessionProvider` 维护界面状态。
5. **部署友好**：不需要为前端准备签名密钥（容器构建阶段拿不到运行时密钥）。

### 1.3 非目标

- 第三方 OAuth 登录（Google / GitHub 等）。
- refresh token 轮转、多设备会话管理、主动吊销。
- 二次验证、密码找回、邮箱验证。

---

## 二、术语与边界

| 术语         | 含义                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 会话 token   | Nest 用 `jose` 签发的 HS256 JWT，放在 cookie 里                      |
| 会话 cookie  | 名为 `auth_token`（可配）的 httpOnly cookie，浏览器自动携带          |
| 登录守卫     | 全局 `JwtAuthGuard`，校验 cookie 或 `Authorization: Bearer`          |
| 公开路由     | 用 `@Public()` 标记、无需登录即可访问的接口                          |
| 前端会话状态 | `SessionProvider` 通过 `GET /api/auth/me` 得到的用户信息，仅用于渲染 |

边界：

- **鉴权权威在后端**：前端 middleware 只做粗粒度页面拦截，不能作为安全边界。
- 会话是**无状态 JWT**：后端不存 session 表，也不做主动吊销。
- 前后端**同站**部署（同主机不同端口，或同域名不同子域），`SameSite=Lax` 才成立。

---

## 三、目标架构

```text
浏览器
  │  ① POST /api/auth/login { email, password }
  ├──────────────────────────────────────────────▶ Nest（bcrypt 校验）
  │                                                   │
  │  ② 200 { user } + Set-Cookie: auth_token=<JWT>    │
  ◀───────────────────────────────────────────────────┘
  │
  │  ③ 页面请求 /home ──▶ Next middleware：cookie 是否存在？
  │                          ├─ 不存在 → 302 /auth/login?callbackUrl=/home
  │                          └─ 存在   → 放行
  │
  │  ④ GET /api/auth/me（SessionProvider）
  ├──────────────────────────────────────────────▶ Nest 守卫校验 cookie
  │  ⑤ 200 { user }                                   │
  ◀───────────────────────────────────────────────────┘
  │
  │  ⑥ GET/POST /api/chat/* 等业务接口
  ├──────────────────────────────────────────────▶ Nest 全局守卫（需登录）
```

- 登录链路完全绕过 Next 的服务端：浏览器直接请求 Nest。
- 前端不再有"服务端会话"，`/api/auth/me` 是唯一的状态来源。

---

## 四、接口契约

所有接口挂在 `/api` 下，响应统一为：

```json
{
  "status": { "code": 0, "message": "" },
  "data": {},
  "stack": []
}
```

- `status.code = 0` 表示成功，此时 `message` 为空字符串。
- 业务失败（参数错误、未登录、邮箱重复等）**HTTP 状态仍为 200**，通过 `status.code` 表达错误（400/401/409/500 等），`data` 为 `null`，`message` 为提示文案。
- `stack` 为后端调用栈（按行拆分的字符串数组），成功时为 `[]`；前端不展示。
- 只有代理/网关/网络层错误才可能返回非 200。
- 下文各接口示例只展示 `data` 内容，实际响应统一包一层上述信封。

### 4.1 登录

`POST /api/auth/login`（公开）

```json
{ "email": "user@example.com", "password": "test123456" }
```

成功：

```json
{
  "user": {
    "id": "u_1",
    "email": "user@example.com",
    "name": "Demo",
    "image": null,
    "role": "USER",
    "hasAccess": false
  }
}
```

同时写 cookie：

```
Set-Cookie: auth_token=<JWT>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
```

失败：HTTP 200，`status.code=401`，`status.message=邮箱或密码错误`（不区分"用户不存在"与"密码错误"）。

### 4.2 登出

`POST /api/auth/logout`（公开）

- 清空 cookie（`Max-Age=0`），`data` 为 `{ "success": true }`。
- 即使 cookie 已过期也能调用（无副作用）。

### 4.3 当前用户

`GET /api/auth/me`（需登录）

```json
{
  "user": {
    "id": "u_1",
    "email": "...",
    "name": "...",
    "image": null,
    "role": "ADMIN",
    "hasAccess": true
  }
}
```

- **读数据库**取最新档案，角色变更即时生效（token 里的 claims 仅用于守卫快速判定）。
- 未登录 / token 过期 → HTTP 200，`status.code=401`。

### 4.4 注册

`POST /api/auth/register`（公开）

- 成功：HTTP 200，`status.code=0`。
- 邮箱已存在：HTTP 200，`status.code=409`；参数非法：HTTP 200，`status.code=400`（密码至少 6 位）。
- 注册成功后不自动登录，前端跳转登录页。

### 4.5 守卫与公开路由

| 方法   | 路径                                                        | 鉴权                     |
| ------ | ----------------------------------------------------------- | ------------------------ |
| `POST` | `/api/auth/login`、`/api/auth/logout`、`/api/auth/register` | 公开                     |
| `GET`  | `/api/auth/me`                                              | 需登录                   |
| `GET`  | `/api`、`/api/health`                                       | 公开                     |
| `GET`  | `/api/docs`（含静态资源）                                   | 开发环境公开，生产需登录 |
| `*`    | 其余 `/api/*`（含 `/api/chat/*`、模型配置管理）             | 需登录                   |

- 守卫优先读 `Authorization: Bearer <token>`，其次读 cookie，便于 CLI/脚本调用。
- 旧的 `POST /api/auth/verify-credentials` 已删除。

### 4.6 错误码

HTTP 状态统一为 200，错误看 `status.code`：

| 场景                       | status.code | message                |
| -------------------------- | ----------- | ---------------------- |
| 未携带 / 无效 / 过期 token | 401         | `未登录或登录已过期`   |
| 登录密码错误               | 401         | `邮箱或密码错误`       |
| `/me` 时用户已被删除       | 401         | `用户不存在或已被删除` |
| 注册邮箱重复               | 409         | `该邮箱已被注册`       |
| 注册参数非法               | 400         | 校验提示               |

---

## 五、会话与 Cookie 规格

### 5.1 Token claims

| claim         | 来源             | 用途                       |
| ------------- | ---------------- | -------------------------- |
| `sub`         | `user.id`        | 守卫填充 `request.user.id` |
| `email`       | `user.email`     | 日志与展示                 |
| `role`        | `user.role`      | 守卫可做粗粒度权限         |
| `hasAccess`   | `user.hasAccess` | 同上                       |
| `iat` / `exp` | 签发时间 / TTL   | 过期由 `jose` 校验         |

### 5.2 Cookie 属性

| 属性       | 值                                       | 说明                                         |
| ---------- | ---------------------------------------- | -------------------------------------------- |
| `HttpOnly` | 固定                                     | JS 不可读，降低 XSS 危害                     |
| `SameSite` | `Lax`                                    | 阻止跨站 POST 携带 cookie（CSRF 第一道防线） |
| `Secure`   | `NODE_ENV=production` 时开启             | 生产必须 HTTPS                               |
| `Path`     | `/`                                      | 全站携带                                     |
| `Max-Age`  | 与 `AUTH_TOKEN_TTL` 一致（默认 604800s） | 默认 7 天                                    |

### 5.3 主机一致性（重要）

cookie 按**域名**存储、忽略端口，所以：

- ✅ 浏览器访问 `http://localhost:3000`，API 为 `http://localhost:3001` → 同站，cookie 正常。
- ❌ 浏览器访问 `http://127.0.0.1:3000`，而 API 为 `http://localhost:3001` → 主机不同，cookie 不会带到 middleware，表现为"登录后又被踢回登录页"。

---

## 六、后端实现

### 6.1 文件结构

```
apps/backend/src/auth/
├─ auth.module.ts        # 提供 AuthService / TokenService，注册全局守卫
├─ auth.controller.ts    # login / logout / me / register
├─ auth.service.ts       # 注册、凭据校验、读取最新档案
├─ token.service.ts      # jose 签发与验签（HS256）
├─ jwt-auth.guard.ts     # 全局守卫：cookie 或 Bearer
├─ public.decorator.ts   # @Public()
└─ dto/                  # register / verify-credentials（登录复用）
```

### 6.2 TokenService

- `sign(user)` → `SignJWT({ email, role, hasAccess }).setSubject(id).setExpirationTime(ttl)`。
- `verify(token)` → `jwtVerify(...)`；任何异常一律返回 `null`（不向调用方暴露原因）。
- `parseTtlSeconds('7d' | '12h' | '3600')`：同时用于 cookie 的 `Max-Age`，保证两者一致。

### 6.3 全局守卫

- `JwtAuthGuard` 通过 `APP_GUARD` 注册在 `AuthModule`，**默认拦截所有接口**。
- 放行顺序：`@Public()` → 开发环境的 `/api/docs*` → 其余一律校验。
- 校验成功把 payload 挂到 `request.user`，失败抛 `UnauthorizedException`。

### 6.4 启动与中间件

- `main.ts`：缺少 `AUTH_SECRET` 时**启动即抛错**（避免带着可伪造的会话运行）。
- `main.ts`：`app.use(cookieParser())`，守卫从 `request.cookies` 读取会话。
- CORS 保持 `credentials: true`（浏览器跨端口请求必须带凭据）。

### 6.5 移除项

- `POST /api/auth/verify-credentials` 路由（逻辑合并进 `verifyCredentials()`，供登录内部调用）。
- 前端 `next-auth` 相关的一切（见第七节）。

---

## 七、前端实现

### 7.1 删除清单

| 文件                                      | 原因                   |
| ----------------------------------------- | ---------------------- |
| `src/server/auth.ts`                      | NextAuth 配置          |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth 路由          |
| `src/provider/NextAuthProvider.tsx`       | `SessionProvider` 包装 |
| `package.json` 的 `next-auth`             | 不再需要               |

### 7.2 SessionProvider

`src/provider/session-provider.tsx`：

- `useSession()` 返回 `{ data, status, refresh, logout }`，形状与原来的 `next-auth` 用法兼容，减少调用方改动。
- 路由变化时重新请求 `/api/auth/me`，登录/退出后界面立即更新。
- **竞态处理**：用 `checkedPath` 记录"会话检查针对的是哪个路由"，只有 `checkedPath === pathname` 时才允许"未登录跳转"。否则登录成功跳转 `/home` 的瞬间会拿着登录页的 `unauthenticated` 状态把用户弹回登录页。
- `/me` 返回 `status.code=401`（cookie 过期/伪造）→ 自动跳转 `/auth/login?callbackUrl=<当前路径>`。

### 7.3 请求封装

`src/utils/api.ts` 基于 axios，是浏览器侧唯一 JSON 请求入口：

- axios 实例统一 `baseURL`、`withCredentials: true`、30s 超时；对象 `data` 自动 JSON 序列化。
- 响应拦截器校验 `{ status, data, stack }`：`status.code !== 0` 时抛 `ApiError`（含 `code` / `serverStack`），并默认弹一次 toast；`silent: true` 可关闭。
- 401（`status.code === 401` 或 HTTP 401）触发全局会话失效，`SessionProvider` 清状态并跳 `/auth/login?callbackUrl=…`；登录、注册、登出、`/me` 传 `skipAuthRedirect: true`。
- 非 200（代理/网络异常）也走同一 `ApiError` 归一化；网络失败、超时、主动取消有独立文案。
- SSE / 流式接口不在 axios 层处理，后续使用 `fetch-event-source`。

### 7.4 middleware 的职责边界

```ts
// 只判断 cookie 是否存在，不验签
if (!request.cookies.has(COOKIE_NAME)) redirect('/auth/login?callbackUrl=…')
```

为什么不在这里验签：

- Next middleware 默认跑在 **Edge runtime**，`process.env.AUTH_SECRET` 会在**构建期被内联**。
- 实测：把 `apps/frontend/.env` 移走后再构建（模拟 Docker 构建阶段），带**合法** cookie 访问 `/home` 直接被 307 弹回登录页 —— 因为构建时 secret 为空。
- 因此 middleware 只做"有没有 cookie"的粗拦截；**真正的鉴权在后端守卫**，cookie 失效时由 `SessionProvider` 的 401 兜底跳转。

### 7.5 页面改动

| 文件                                 | 改动                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `app/auth/login/page.tsx`            | `signIn()` → `request({ url: '/api/auth/login', method: 'POST', data, skipAuthRedirect: true })`，成功 `router.push(callbackUrl)` |
| `app/auth/register/page.tsx`         | 改用 `request(..., { skipAuthRedirect: true })`（行为不变）                                                                       |
| `components/header/avatar/index.tsx` | `useSession()` 换成新 provider；`signOut` → `logout()`                                                                            |
| `app/layout.tsx`                     | `NextAuthProvider` → `SessionProvider`                                                                                            |
| `middleware.ts`                      | `getToken` → 判断 cookie 是否存在                                                                                                 |

---

## 八、配置与部署

### 8.1 环境变量

后端（`apps/backend/.env`）：

```bash
AUTH_SECRET="<openssl rand -base64 32>"   # 必填，缺失启动失败
AUTH_TOKEN_TTL=7d                         # 可选
AUTH_COOKIE_NAME=auth_token               # 可选
```

前端（`apps/frontend/.env`）：

```bash
AUTH_COOKIE_NAME="auth_token"   # 需与后端一致；不填默认 auth_token
NEXT_PUBLIC_API_URL="http://localhost:3001"
BACKEND_URL="http://localhost:3001"
```

| 变量               | 所属  | 必填 | 说明              |
| ------------------ | ----- | ---- | ----------------- |
| `AUTH_SECRET`      | 后端  | 是   | HS256 签名密钥    |
| `AUTH_TOKEN_TTL`   | 后端  | 否   | 默认 `7d`         |
| `AUTH_COOKIE_NAME` | 前+后 | 否   | 默认 `auth_token` |

`NEXTAUTH_URL` / `NEXTAUTH_SECRET` 已从 `.env`、`turbo.json`、`docker-compose.yml` 中移除。

### 8.2 Docker / Compose

- `app` 服务：`AUTH_COOKIE_NAME`（不再需要 `AUTH_SECRET`）。
- `backend` 服务：`AUTH_SECRET`、`AUTH_TOKEN_TTL`、`AUTH_COOKIE_NAME`。
- 前端镜像构建阶段**不需要**任何密钥，可在 CI 中安全构建。

### 8.3 反向代理

- 生产必须 HTTPS（`Secure` cookie）。
- 若前端与 API 不同站点（不同主域），需要改为 `SameSite=None; Secure`（当前实现固定 `Lax`，属于非目标）。

---

## 九、安全说明

| 风险           | 现状   | 说明                                                                       |
| -------------- | ------ | -------------------------------------------------------------------------- |
| XSS 窃取 token | 低     | token 在 httpOnly cookie 里，JS 读不到                                     |
| CSRF           | 中低   | `SameSite=Lax` + JSON 请求体（触发预检）；更高要求可加 double-submit token |
| 会话吊销       | 无     | 无状态 JWT，改密码/降权后旧 token 到期前仍有效（默认 7 天）                |
| 暴力破解       | 无     | 登录接口无限流，后续可加 `@nestjs/throttler`                               |
| 密码存储       | 安全   | `bcrypt`（cost 10）                                                        |
| 日志泄漏       | 已规避 | 守卫与登录流程不打印密码、不打印 token                                     |

---

## 十、验收标准

1. 未登录访问任意业务接口（如 `GET /api/chat/models`）返回 HTTP 200 + `status.code=401`。
2. `POST /api/auth/login` 成功返回 `200` 且 `Set-Cookie` 含 `HttpOnly`、`SameSite=Lax`、`Max-Age`。
3. 带 cookie 访问 `GET /api/auth/me` 返回最新用户档案；用 `Authorization: Bearer <token>` 同样可用。
4. `POST /api/auth/logout` 后原 cookie 再访问受保护接口返回 `status.code=401`。
5. 未登录访问 `/home` 被 middleware 重定向到 `/auth/login?callbackUrl=%2Fhome`。
6. 浏览器全流程通过：登录 → `/home` 显示头像 → 打开设置弹窗（受保护接口正常）→ 退出 → 回登录页；再访问 `/home` 再次被拦截。
7. 伪造/过期 cookie：middleware 放行后，`SessionProvider` 在 `/me` 返回 `status.code=401` 时跳回登录页。
8. 前端在**没有 `.env` 的环境**构建后，带合法 cookie 访问 `/home` 仍为 `200`（验证 middleware 不依赖构建期密钥）。
9. `pnpm lint` / `pnpm typecheck` / `pnpm build` 全绿。

---

## 十一、实施记录（2026-10）

| 项                                  | 结果                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 未登录 `GET /api/chat/models`       | HTTP 200，`status.code=401` `未登录或登录已过期`                                                              |
| `POST /api/auth/login`              | 200，`Set-Cookie: auth_token=…; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`                               |
| 带 cookie `GET /api/auth/me`        | 200，返回 `{ id, email, name, role, hasAccess }`                                                              |
| `Authorization: Bearer`             | 200（同一 token 两种传法都可用）                                                                              |
| `POST /api/auth/logout` 后访问      | HTTP 200，`status.code=401`                                                                                   |
| 未登录访问 `/home`                  | 307 → `/auth/login?callbackUrl=%2Fhome`                                                                       |
| 浏览器全流程                        | 伪造 cookie 被弹回登录页；登录 → `/home` 头像正常；设置弹窗加载模型成功；退出 → 登录页；再访问 `/home` 被拦截 |
| 无 `.env` 构建 + 合法 cookie        | 200（修复前为 307）                                                                                           |
| `pnpm lint` / `typecheck` / `build` | 全绿                                                                                                          |

实施中遇到并修复的问题：

1. **旧 `.next/types` 残留**：删除 `[...nextauth]` 路由后，上次构建生成的路由类型仍引用它，`tsc` 报 `TS2307`。清理 `.next/types` 后恢复。
2. **middleware 验签依赖构建期密钥**（见 §7.4），改为只判断 cookie 存在。
3. **登录后被弹回登录页**：`SessionProvider` 使用了上一页的 `unauthenticated` 状态触发跳转，用 `checkedPath` 收敛为"只对当前路由的检查结果生效"。

---

## 十二、非目标与后续

后续可做：

- 第三方 OAuth：把 next-auth 作为 OAuth 适配层，换取 Nest 的会话 cookie（不建议反向让 Nest 解 NextAuth 的 JWT）。
- 会话吊销：`User.tokenVersion` + 守卫比对，改密码时递增。
- 登录限流（`@nestjs/throttler`）、失败次数锁定。
- 密码找回、邮箱验证、二次验证。
- 清理 NextAuth 适配器遗留表：`Account`、`Session`、`VerificationToken`（`db push` 会删数据，确认无用途后再做）。

---

## 附：相关文档

- [Monorepo 方案](monorepo.md) §21 —— 改造背景与取舍
- [AI 对话接口](chat.md) —— `/api/chat/*` 均需登录
- [目录结构](directory-structure.md) —— `src/auth`、`src/provider` 的位置
