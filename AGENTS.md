# AGENTS.md

> 本文件用于指导 AI Coding Agent（如 Codex、Cursor、Claude Code、Windsurf、Gemini CLI 等）理解项目架构和开发规范。
>
> 修改代码前，请优先阅读本文件。

---

# 一、项目简介

本项目基于 Next.js（App Router）开发，采用前后端一体化架构。

目标：

- 高性能
- 可维护
- 类型安全
- 模块化
- 低耦合
- 易于 AI 协同开发

修改代码时，应保持现有架构风格，不随意重构。

---

# 二、技术栈

## 基础框架

- Next.js 15（App Router）
- React 19
- TypeScript

## UI

- Tailwind CSS 4
- shadcn/ui（基于 Radix UI）
- Lucide React 图标
- Remix Icon

## 数据

- Server Components
- Server Actions
- Prisma 7

## 认证

- NextAuth v5（beta）

## 状态管理

- Zustand

## 表单

- React Hook Form + Zod

## 工具库

- ahooks
- immer
- lodash-es

## 包管理

- pnpm

---

# 三、详细文档

详细规范请参阅以下文档：

- [目录结构](docs/directory-structure.md) — 项目目录组织与各目录职责
- [架构原则](docs/architecture.md) — 架构设计、Server Component、组件规范、状态管理
- [编码规范](docs/coding-conventions.md) — TypeScript、样式、命名、接口、错误处理、性能
- [AI 修改指南](docs/ai-guidelines.md) — AI 修改代码的规范、禁止事项、提交检查清单

---

# 四、常用命令

| 命令             | 说明     |
| ---------------- | -------- |
| `pnpm dev`       | 开发     |
| `pnpm build`     | 构建     |
| `pnpm typecheck` | 类型检查 |
| `pnpm lint`      | Lint     |
| `pnpm test`      | 测试     |
