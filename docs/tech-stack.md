# 技术栈

> 本文件描述项目实际使用的主要技术。

---

## 基础框架

- Next.js 15（App Router）
- React 19
- TypeScript
- pnpm

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
- NextAuth v5 beta
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
