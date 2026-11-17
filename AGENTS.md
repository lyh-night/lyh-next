# AGENTS.md

> 本文件用于指导 AI Coding Agent（如 Codex、Cursor、Claude Code、Windsurf、Gemini CLI 等）理解项目架构和开发规范。
>
> 修改代码前，请先阅读本文件，并按任务类型继续阅读对应模块文档。

---

# 一、项目简介

本项目是基于 pnpm workspaces + Turborepo 的 monorepo，前端为 Next.js（App Router），后端为独立的 NestJS 服务。

```text
apps/frontend        →  packages/components  →  packages/utils
apps/backend         →  独立 NestJS API（不依赖 packages/*）
```

目标：

- 高性能
- 可维护
- 类型安全
- 模块化
- 低耦合
- 易于 AI 协同开发

修改代码时，应保持现有架构风格，不随意重构。

---

# 二、文档索引

详细规范按两个目录归档（结构说明见 [docs/README.md](docs/README.md)）：

**`docs/agents/` — 开发规范与指南（与 AGENTS.md 配套，跨功能通用）**

- [技术栈](docs/agents/tech-stack.md) — 框架、UI、数据、认证、状态管理与工具库
- [目录结构](docs/agents/directory-structure.md) — 项目目录组织与各目录职责
- [架构原则](docs/agents/architecture.md) — 架构设计、Server Component、组件规范、状态管理
- [编码规范](docs/agents/coding-conventions.md) — TypeScript、样式、命名、接口、错误处理、性能
- [AI 修改指南](docs/agents/ai-guidelines.md) — AI 修改代码的规范、禁止事项、提交检查清单
- [常用命令](docs/agents/commands.md) — 开发、构建、数据库和 Docker 部署命令
- [Monorepo 方案](docs/agents/monorepo.md) — 包边界、迁移映射、配置改造与验收标准

**`docs/features/` — 功能与契约文档（每个功能/模块一份，新功能文档放这里）**

- [AI 对话接口](docs/features/chat.md) — chat 模块、数据库模型配置、多轮记忆与 SSE 协议
- [登录认证](docs/features/auth.md) — Nest 托管会话、cookie 规格、全局守卫与前端会话状态
- [响应与错误处理](docs/features/err-handing.md) — 扁平信封、业务码表（1xxxx 通用 / 2xxxx 认证 / 3xxxx 对话）、过滤器与日志契约
- [实时通信](docs/features/realtime.md) — 实时通道设计与协议约定

- NestJS 规范 skill（`.agent/skills/`）：`nestjs-architecture`（模块与 DI）、`nestjs-api-contract`（信封与 DTO）、`nestjs-config-env`（环境变量）、`nestjs-error-handling`（过滤器与日志）；修改后端前按任务加载对应 skill
- 官方通用 skill（`.agent/skills/`，来自 [anthropics/skills](https://github.com/anthropics/skills)，保留原 LICENSE）：`webapp-testing`（Playwright 验证前端，需 python3 + playwright）、`frontend-design`（UI 视觉设计）、`skill-creator`（创建/维护 skill，含校验脚本）

---

# 三、AI 工作约定

修改代码前：

1. 先阅读本文件。
2. 根据任务类型阅读对应模块文档。
3. 核对 `package.json` 中真实存在的脚本后再执行命令。
4. 保持最小修改范围，不处理与当前任务无关的问题。
5. 遇到自动生成目录（如 `src/generated`）时，不要手动修改其内容。

---

# 四、前端组件与代码拆分规则

底线：单文件 ≤ 200 行、单一职责。超过即拆，按「页面结构 → 交互逻辑 → 纯函数 → 公共 UI」四层落位。

## 4.1 目录按页面结构组织

- 功能组件放 `apps/frontend/src/components/<feature>/`，一级子目录 = 页面结构单元（如 chat 的
  `sidebar/`、`messages/`、`composer/`、`markdown/`）或逻辑层 `hooks/`。
- 功能根目录只保留：`index.tsx`（页面组合）、`types.ts`（共享类型）、`api.ts`（接口封装）、
  `stream.ts`（特殊传输层）。
- 文件名 kebab-case；导出组件名 PascalCase。

## 4.2 组件粒度

- 一个组件 = 一个用户可见单元（弹窗、列表项、气泡、工具条、空态）。
- 弹窗 / 确认框 / 列表项 / 工具栏必须独立成文件，禁止内联在父组件里堆到 300 行。
- 组件只做渲染与局部 UI 状态（open / copied / hover）；禁止在组件内调用 api、fetch、localStorage。

## 4.3 交互逻辑与业务逻辑分离

- 请求、流式、定时器、localStorage、URL 同步等副作用只允许出现在 `hooks/` 或 `utils/`。
- 按领域拆 `use-*.ts`；`use-<feature>.ts` 只做组合与对外 controller，导出 shape 保持稳定。
- 数据流方向固定：`Component → Hook → api.ts → utils/api.ts`。

## 4.4 纯函数去向（按复用范围）

| 场景                                         | 去处                                               |
| -------------------------------------------- | -------------------------------------------------- |
| 跨应用通用、无业务语义/产品文案              | `packages/utils/src/`（经 `@lyh-next/utils` 导出） |
| 应用语义（依赖业务类型、中文文案、接口约定） | `apps/frontend/src/utils/*.ts`                     |
| 仅单一组件消费                               | 与组件同文件（可留模块级函数）                     |

- `utils` 只允许 type-only 引用 app 类型，禁止 import 组件实现（防反向依赖）。
- `packages/utils` 中含 `window`/`document` 的函数必须 JSDoc 标注「仅 client 侧调用」。

## 4.5 纯 UI 组件下沉 packages/components

- 无业务耦合、可被任意应用复用的展示/交互组合（如 `ConfirmDialog`、`EmptyState`）→
  `packages/components/src/common/`，并在 `src/index.ts` re-export。
- 依赖业务数据/接口的（如消息气泡、模型选择器）留在应用内。
- 仍禁止新增与 shadcn 重复的浮层组件；`common/` 只做 shadcn 的组合封装。

---

# 五、当前项目事实

- 包管理器：pnpm（锁定 `pnpm@11.7.0`），workspace 定义在 `pnpm-workspace.yaml`
- 任务编排：Turborepo（`turbo.json`），构建有缓存
- Node 要求：`>=22.18`（tsdown 的硬性要求）
- 仓库结构：`apps/frontend`（Next.js）、`apps/backend`（NestJS）、`packages/components`、`packages/utils`
- 应用框架：Next.js 15 App Router（`apps/frontend`）
- 后端框架：NestJS 12 + Express（`apps/backend`，ESM，独立 tsconfig，端口 3001，所有路由带 `/api` 前缀）
- 后端基础设施：`@nestjs/config` + `common/config/env.validation.ts` 启动期校验环境变量（缺 `AUTH_SECRET` / `DATABASE_URL` 直接失败，默认值集中声明）、全局 `ValidationPipe`（query 数字字段用 `@Type` 显式转换）、`CommonModule` 以 `APP_FILTER` / `APP_INTERCEPTOR` 注册全局过滤器与拦截器、`TransformInterceptor` + `HttpExceptionFilter` 统一响应扁平信封 `{ code, message, data, stack? }`（JSON 接口 HTTP 统一 200；`code=0` 成功，失败为业务码：`10002` 未登录、`10001` 参数、`10004` 不存在、`20001/20002` 认证、`3xxxx` 对话，码表见 `common/errors/api-code.ts` 与 `docs/features/err-handing.md`；`stack` 仅未预期异常且非生产返回），抛错用 `ApiException(code, message, httpStatus)`、`LoggingInterceptor`（结构化访问日志）、`GET /api/health/live`（存活，纯 JSON）与 `GET /api/health`（就绪，ping 数据库，不可达 503）、`/api/docs`（Swagger）、`PrismaModule`（全局）、`AuthModule`；全局限流 `@nestjs/throttler`（默认 300 次/分钟，登录 10、completions 20，超限信封 `code=10006`）；请求追踪 `X-Request-Id` 中间件（`common/request-context/`）；结构化日志 pino（`common/logging/pino-logger.service.ts`，生产 JSON / 开发 pino-pretty，`LOG_LEVEL`、`SLOW_REQUEST_MS` 可调，访问日志字段 method/path/httpStatus/code/durationMs/requestId/userId）；上游建连超时 `CHAT_UPSTREAM_CONNECT_TIMEOUT_MS`（默认 15s，只约束到响应头）+ 建连失败自动重试一次；helmet 安全响应头（CSP 关闭以支持 Swagger）；限流存储配 `REDIS_URL` 切 Redis（多实例），留空内存
- 前端调用后端：浏览器侧统一走 `src/utils/api.ts` 的 axios `request`（`baseURL` 取 `NEXT_PUBLIC_API_URL`，`withCredentials`），服务端用 `BACKEND_URL`
- 认证方案：**Nest 托管**。`POST /api/auth/login` 校验后写 httpOnly JWT cookie（`AUTH_SECRET`，默认 7 天），`GET /api/auth/me` 返回当前用户，`POST /api/auth/logout` 清除；后端全局 `JwtAuthGuard` 默认要求登录，公开路由用 `@Public()` 显式声明。**前端已移除 next-auth**，`src/provider/session-provider.tsx` 只做会话状态展示；`middleware.ts` 只判断会话 cookie 是否存在（Edge 构建期无法安全读 secret），cookie 失效时由 `SessionProvider` 收到 `code=10002` 后跳回登录页
- AI 对话：`apps/backend/src/chat`，`POST /api/chat/completions` 为 OpenAI 协议 SSE（逐帧透传上游，成功响应不包统一信封）；模型配置（baseUrl/apiKey/model/provider）存数据库 `AiModel` 表，**不走环境变量**，由前端「头像 → 设置 → 模型」弹窗维护（`/api/chat/models/configs` 等接口，密钥只返回掩码）；多轮记忆与历史都在后端（表 `Conversation` / `ChatMessage`），会话按用户隔离（`Conversation.userId`，service 层按 `@CurrentUser()` 过滤，越权统一 `30001`）
- AI 对话前端：`/chat` 页面 + `src/components/chat/`（按页面结构分 `sidebar/`、`messages/`、`composer/`、`markdown/`，交互与业务逻辑在 `hooks/`；`stream.ts` 用 fetch + `eventsource-parser/stream` 实现 SSE，不自动重连；`markdown/markdown.tsx` 用 `react-markdown` + `remark-gfm` 渲染回复；controller 在 `hooks/use-chat.ts`，当前会话写 URL `?c=<id>`）
- 数据库 ORM：Prisma 7 + PostgreSQL，schema、Prisma Client 与 `DATABASE_URL` 都在 `apps/backend`（`apps/backend/prisma`、`apps/backend/.env`）；schema 变更走 `pnpm db:migrate`（`prisma/migrations/` 有 0001_init 基线，勿再用 `db:push` 改结构），生产部署由 compose 一次性 `migrate` 服务执行 `migrate deploy`；**前端不直连数据库**，也不要再给前端加 Prisma 依赖
- 部署方式：支持 Docker / Docker Compose（前端 standalone 产物路径含 `apps/frontend/` 层级；后端镜像 `apps/backend/Dockerfile`，构建上下文为仓库根）
- 根 `package.json` 已定义 `dev`/`build`/`lint`/`typecheck`/`db:push`/`db:studio` 等脚本（backend 另有 `db:migrate` / `db:deploy`，可选环境变量含 `LOG_LEVEL` / `SLOW_REQUEST_MS` / `CHAT_UPSTREAM_CONNECT_TIMEOUT_MS` / `REDIS_URL`）；**没有** `test` 脚本，不要假定它存在
- 仓库**不含自动化测试**：不要引入 vitest / jest / supertest，也不要新增 `*.spec.ts` 或 `*.e2e-spec.ts`
- 跨包共享的版本写在 `pnpm-workspace.yaml` 的 `catalog`（react / react-dom / 类型包 / react-hook-form / typescript），包内用 `"catalog:"` 引用，不要写死版本
- 公共组件从统一出口导入：`import { Button, Tooltip } from '@lyh-next/components'`；工具函数从 `@lyh-next/utils` 导入；包内禁止使用 `@/*` 应用别名
- 组件库样式由包提供：应用入口 `src/styles/index.css` 中 `@import '@lyh-next/components/styles.css'`，不要在 app 里重复定义 shadcn 主题变量
- 全局基础样式必须写在 `@layer base` 内：未分层声明的优先级高于 Tailwind 的 utilities 层，直接写 `div { color: ... }` 会覆盖 `text-*` 等工具类
- **同一功能只保留 shadcn/ui 版本**：不要新增与 shadcn 重复的 tooltip / popover / dropdown 等自研组件；新增 shadcn 组件后需在 `packages/components/src/index.ts` 补一行 re-export
