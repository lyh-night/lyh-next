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

**`docs/agents/` — 开发规范与指南（与 AGENTS.md 配套，跨功能通用）**

- [技术栈](docs/agents/tech-stack.md) — 框架、UI、数据、认证、状态管理与工具库
- [目录结构](docs/agents/directory-structure.md) — 项目目录组织与各目录职责
- [架构原则](docs/agents/architecture.md) — 架构设计、Server Component、组件规范、状态管理
- [编码规范](docs/agents/coding-conventions.md) — TypeScript、样式、命名、接口、错误处理、性能、组件拆分
- [AI 修改指南](docs/agents/ai-guidelines.md) — AI 修改代码的规范、禁止事项、提交检查清单
- [常用命令](docs/agents/commands.md) — 开发、构建、数据库和 Docker 部署命令

**功能与调研文档（`docs/features/`、`docs/research/`）**：索引由 [docs/README.md](docs/README.md) 维护。
新增功能文档直接放进对应目录并登记到 README，**无需修改本文件**；按任务类型按需阅读，例如改对话接口时先读
`docs/features/chat.md`。

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

# 四、当前项目事实

- **仓库**：pnpm（锁 `pnpm@11.7.0`）+ Turborepo 的 monorepo，Node `>=22.18`；`apps/frontend`（Next.js 15 App Router）、`apps/backend`（NestJS 12 + Express，ESM，:3001，路由统一 `/api` 前缀）、`packages/components`、`packages/utils`
- **包与脚本**：跨包版本写 `pnpm-workspace.yaml` 的 `catalog`（包内用 `"catalog:"`）；根 `package.json` 有 `dev`/`build`/`lint`/`typecheck`/`db:*`，**没有** `test`；仓库不含自动化测试，不要引入 vitest/jest/supertest 或 `*.spec.ts`
- **后端**：全局过滤器 + 拦截器输出扁平信封 `{ code, message, data, stack? }`（JSON 接口 HTTP 统一 200，`code=0` 成功，码表见 `docs/features/err-handing.md`），抛错用 `ApiException`；`@nestjs/config` 启动期校验环境变量；`@nestjs/throttler` 限流（超限 `10006`，配 `REDIS_URL` 换 Redis 存储）；`X-Request-Id` 追踪 + pino 结构化日志；健康探测 `GET /api/health/live`（存活）、`GET /api/health`（就绪，ping 数据库）；`/api/docs`（Swagger）；helmet 安全头；可选环境变量清单见 `docs/agents/tech-stack.md`
- **认证**：Nest 托管，`POST /api/auth/login` 写 httpOnly JWT cookie（`AUTH_SECRET`，默认 7 天），`GET /api/auth/me`、`POST /api/auth/logout`；全局 `JwtAuthGuard` 默认要求登录，公开路由用 `@Public()`；前端已移除 next-auth，`middleware.ts` 只判 cookie 存在，`SessionProvider` 收到 `10002` 跳登录页
- **AI 对话后端**：`apps/backend/src/chat`，`POST /api/chat/completions` 为 OpenAI 协议 SSE（成功响应不包信封）；模型配置存 `AiModel` 表、由设置页维护（**不走环境变量**，密钥只回掩码）；多轮记忆与历史在后端（`Conversation` / `ChatMessage`），按 `Conversation.userId` 隔离，越权统一 `30001`
- **AI 对话前端**：`/chat` + `src/components/chat/`（按页面结构分 `sidebar/`、`messages/`、`composer/`、`markdown/`，交互与状态在 `hooks/`）；SSE 在 `stream.ts`（fetch + `eventsource-parser/stream`，不自动重连）；controller 在 `hooks/use-chat.ts`，当前会话写 URL `?c=<id>`
- **前端调用后端**：浏览器侧统一 `src/utils/api.ts` 的 axios `request`（`NEXT_PUBLIC_API_URL` + `withCredentials`），服务端用 `BACKEND_URL`；不要自拼 baseURL 或判断 HTTP status
- **数据库**：Prisma 7 + PostgreSQL，schema、Client、`DATABASE_URL` 都在 `apps/backend`；改结构走 `pnpm db:migrate`（`prisma/migrations/` 已有基线，勿用 `db:push`），部署由 compose 一次性 `migrate` 服务执行 `migrate deploy`；前端不直连数据库
- **部署**：Docker / Compose（前端 standalone 产物路径含 `apps/frontend/` 层级；后端镜像 `apps/backend/Dockerfile`，构建上下文为仓库根）
- **导入与样式**：公共组件 `import { … } from '@lyh-next/components'`、工具函数从 `@lyh-next/utils`，包内禁止 `@/*` 别名；主题变量由 `@lyh-next/components/styles.css` 提供，app 内不重复定义；全局基础样式只写 `@layer base`；**同一功能只保留 shadcn/ui 版本**，新增 shadcn 组件要在 `packages/components/src/index.ts` 补 re-export
