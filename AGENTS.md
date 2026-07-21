# AGENTS.md

> 本文件用于指导 AI Coding Agent（如 Codex、Cursor、Claude Code、Windsurf、Gemini CLI 等）理解项目架构和开发规范。
>
> 修改代码前，请先阅读本文件，并按任务类型继续阅读对应模块文档。

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

# 二、文档索引

详细规范已拆分到以下模块：

- [技术栈](docs/tech-stack.md) — 框架、UI、数据、认证、状态管理与工具库
- [目录结构](docs/directory-structure.md) — 项目目录组织与各目录职责
- [架构原则](docs/architecture.md) — 架构设计、Server Component、组件规范、状态管理
- [编码规范](docs/coding-conventions.md) — TypeScript、样式、命名、接口、错误处理、性能
- [AI 修改指南](docs/ai-guidelines.md) — AI 修改代码的规范、禁止事项、提交检查清单
- [常用命令](docs/commands.md) — 开发、构建、数据库和 Docker 部署命令

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

- 包管理器：pnpm
- 应用框架：Next.js 15 App Router
- 认证方案：NextAuth v5 beta
- 数据库 ORM：Prisma 7 + PostgreSQL
- 部署方式：支持 Docker / Docker Compose
- 当前 `package.json` 未定义 `typecheck`、`test` 脚本，不要在文档或流程中假定它们存在。
