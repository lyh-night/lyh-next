# 技术栈

> 本文件描述项目实际使用的主要技术。

---

## 基础框架

- Next.js 15（App Router）
- React 19
- TypeScript
- pnpm

## 后端（NestJS 12 + Express，ESM）

- Prisma 7 + PostgreSQL（驱动适配器 `@prisma/adapter-pg`）
- pino（结构化日志，开发环境 pino-pretty）
- helmet（安全响应头）
- @nestjs/throttler（接口限流；多实例配 `REDIS_URL` 时经 throttler-storage-redis + ioredis 共享计数）
- jose（JWT）、bcryptjs、class-validator / class-transformer

---

## 工程化（monorepo）

- pnpm workspaces（`apps/*` + `packages/*`）
- Turborepo 2（任务编排与构建缓存）
- tsdown（`@lyh-next/utils` 的 ESM + d.ts 构建）
- ESLint 9 flat config / Prettier / Husky / lint-staged / Commitlint

---

## UI

- Tailwind CSS 4
- shadcn/ui（基于 Radix UI）
- Lucide React
- Remix Icon
- next-themes

---

## 数据与认证

- Prisma 7
- PostgreSQL
- 认证：Nest 签发 httpOnly JWT cookie（`jose`），前端自建 `SessionProvider`（已移除 next-auth）
- @auth/prisma-adapter
- @prisma/adapter-pg

---

## 状态与表单

- Zustand
- immer
- React Hook Form
- Zod

---

## 工具库

- axios（前端统一 JSON 请求，`apps/frontend/src/utils/api.ts`）
- eventsource-parser（SSE 解析：对话流式接口，`apps/frontend/src/components/chat/stream.ts`）
- react-markdown + remark-gfm（对话回复 Markdown 渲染，`apps/frontend/src/components/chat/markdown.tsx`）
- ahooks
- lodash-es
- clsx
- class-variance-authority
- tailwind-merge
- bcryptjs
- uuid

---

## 工作流编辑器

- @xyflow/react

---

## 部署

- Docker
- Docker Compose
- Next.js standalone output
