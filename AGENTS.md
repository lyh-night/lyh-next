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

详细规范已拆分到以下模块：

- [技术栈](docs/tech-stack.md) — 框架、UI、数据、认证、状态管理与工具库
- [目录结构](docs/directory-structure.md) — 项目目录组织与各目录职责
- [架构原则](docs/architecture.md) — 架构设计、Server Component、组件规范、状态管理
- [编码规范](docs/coding-conventions.md) — TypeScript、样式、命名、接口、错误处理、性能
- [AI 修改指南](docs/ai-guidelines.md) — AI 修改代码的规范、禁止事项、提交检查清单
- [常用命令](docs/commands.md) — 开发、构建、数据库和 Docker 部署命令
- [Monorepo 方案](docs/monorepo.md) — 包边界、迁移映射、配置改造与验收标准
- [AI 对话接口](docs/chat.md) — chat 模块、数据库模型配置、多轮记忆与 SSE 协议

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

- 包管理器：pnpm（锁定 `pnpm@11.7.0`），workspace 定义在 `pnpm-workspace.yaml`
- 任务编排：Turborepo（`turbo.json`），构建有缓存
- Node 要求：`>=22.18`（tsdown 的硬性要求）
- 仓库结构：`apps/frontend`（Next.js）、`apps/backend`（NestJS）、`packages/components`、`packages/utils`
- 应用框架：Next.js 15 App Router（`apps/frontend`）
- 后端框架：NestJS 12 + Express（`apps/backend`，ESM，独立 tsconfig，端口 3001，所有路由带 `/api` 前缀）
- 后端基础设施：`@nestjs/config` 环境变量、全局 `ValidationPipe`、`HttpExceptionFilter` 统一错误、`LoggingInterceptor`、`GET /api/health`、`/api/docs`（Swagger）、`PrismaModule`（全局）、`AuthModule`
- 前端调用后端：浏览器侧用 `NEXT_PUBLIC_API_URL`（`src/utils/api.ts` 的 `apiUrl()`），服务端用 `BACKEND_URL`
- 认证方案：NextAuth v5 beta，前端只负责会话（JWT）；凭据校验与注册在 backend（`POST /api/auth/verify-credentials`、`POST /api/auth/register`）
- AI 对话：`apps/backend/src/chat`，`POST /api/chat/completions` 为 OpenAI 协议 SSE（逐帧透传上游）；模型配置（baseUrl/apiKey/model）存数据库 `AiModel` 表，**不走环境变量**；多轮记忆与历史都在后端（表 `Conversation` / `ChatMessage`）
- 数据库 ORM：Prisma 7 + PostgreSQL，schema、Prisma Client 与 `DATABASE_URL` 都在 `apps/backend`（`apps/backend/prisma`、`apps/backend/.env`）；**前端不直连数据库**，也不要再给前端加 Prisma 依赖
- 部署方式：支持 Docker / Docker Compose（前端 standalone 产物路径含 `apps/frontend/` 层级；后端镜像 `apps/backend/Dockerfile`，构建上下文为仓库根）
- 根 `package.json` 已定义 `dev`/`build`/`lint`/`typecheck`/`db:push`/`db:studio` 等脚本；**没有** `test` 脚本，不要假定它存在
- 仓库**不含自动化测试**：不要引入 vitest / jest / supertest，也不要新增 `*.spec.ts` 或 `*.e2e-spec.ts`
- 跨包共享的版本写在 `pnpm-workspace.yaml` 的 `catalog`（react / react-dom / 类型包 / react-hook-form / typescript），包内用 `"catalog:"` 引用，不要写死版本
- 公共组件从统一出口导入：`import { Button, Tooltip } from '@lyh-next/components'`；工具函数从 `@lyh-next/utils` 导入；包内禁止使用 `@/*` 应用别名
- 组件库样式由包提供：应用入口 `src/styles/index.css` 中 `@import '@lyh-next/components/styles.css'`，不要在 app 里重复定义 shadcn 主题变量
- 全局基础样式必须写在 `@layer base` 内：未分层声明的优先级高于 Tailwind 的 utilities 层，直接写 `div { color: ... }` 会覆盖 `text-*` 等工具类
- **同一功能只保留 shadcn/ui 版本**：不要新增与 shadcn 重复的 tooltip / popover / dropdown 等自研组件；新增 shadcn 组件后需在 `packages/components/src/index.ts` 补一行 re-export
