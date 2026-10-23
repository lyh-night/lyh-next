# lyh-next

基于 Next.js + @xyflow/react + Zustand + TailwindCSS 构建的可视化工作流编排系统。

## 技术栈

| 分类     | 技术                                               |
| -------- | -------------------------------------------------- |
| 框架     | Next.js 15（App Router）、React 19、TypeScript     |
| UI       | TailwindCSS 4、shadcn/ui、Lucide React、Remix Icon |
| 数据     | Prisma 7、PostgreSQL 16                            |
| 认证     | NextAuth v5 beta                                   |
| 状态     | Zustand                                            |
| 表单     | React Hook Form + Zod                              |
| 工具库   | ahooks、immer、lodash-es                           |
| 工程化   | pnpm workspaces、Turborepo、tsdown                 |
| 代码规范 | ESLint、Prettier、Husky、Lint-Staged、Commitlint   |

## 预览

![screenshot](./docs/image.png)

## 入门指南

### 前置条件

- [Node.js](https://nodejs.org/) >= 22.18
- [pnpm](https://pnpm.io/) >= 10（仓库锁定 `pnpm@11.7.0`）
- [Docker](https://www.docker.com/get-started/) & Docker Compose

### 1. 安装依赖

```bash
git clone https://github.com/lyh-night/lyh-next.git
cd lyh-next
pnpm install
```

### 2. 配置环境变量

复制示例文件并填写配置（`.env` 位于应用包内，Next 与 Prisma CLI 都从这里读取）：

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

`.env` 文件各字段说明：

```bash
# ── 数据库 ──────────────────────────────────────────────
# 使用 Docker 容器时，保持默认即可（连接本地 6432 端口）
# 格式：postgresql://用户名:密码@主机:端口/数据库名
DATABASE_URL="postgresql://postgres:postgres@localhost:6432/lyh-next-db"

# ── NextAuth ────────────────────────────────────────────
# 应用访问地址，生产环境改为实际域名
NEXTAUTH_URL="http://localhost:3000"

# 会话加密密钥，用于签名 JWT 和加密敏感信息
# 生产环境务必替换为强随机字符串（可用 `openssl rand -base64 32` 生成）
NEXTAUTH_SECRET="your-secret-key-here"
```

| 字段              | 必填 | 说明                           |
| ----------------- | ---- | ------------------------------ |
| `DATABASE_URL`    | 是   | PostgreSQL 连接字符串          |
| `NEXTAUTH_URL`    | 是   | 应用访问地址                   |
| `NEXTAUTH_SECRET` | 是   | 会话加密密钥，生产环境必须替换 |

### 3. 启动数据库

项目使用 Docker Compose 管理 PostgreSQL，无需手动安装数据库。

```bash
docker compose up -d db
```

这会启动一个 PostgreSQL 16 容器，配置如下：

| 配置项   | 默认值               |
| -------- | -------------------- |
| 镜像     | `postgres:16-alpine` |
| 数据库名 | `lyh-next-db`        |
| 用户名   | `postgres`           |
| 密码     | `postgres`           |
| 宿主端口 | `6432`               |

等待数据库就绪后，推送 Schema：

```bash
pnpm db:push
```

> 可通过 `pnpm db:studio` 打开 Prisma Studio 管理数据库。

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

> `pnpm dev` 会同时启动前端（3000）、后端（3001）与 `packages/utils` 的 watch。
> 也可单独启动：`pnpm dev:frontend` / `pnpm dev:backend`。

### 后端

`apps/backend` 是基于 NestJS 12 的独立 API 服务，默认监听 **3001**，所有路由带 `/api` 前缀：

| 路径          | 说明         |
| ------------- | ------------ |
| `/api`        | 服务信息     |
| `/api/health` | 健康检查     |
| `/api/docs`   | Swagger 文档 |

```bash
cp apps/backend/.env.example apps/backend/.env   # PORT / NODE_ENV / CORS_ORIGINS，可省略
pnpm dev:backend
curl http://localhost:3001/api/health
```

### 常用命令

| 命令                 | 说明                                      |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | 启动开发服务器（turbo 并行编排前后端）    |
| `pnpm dev:backend`   | 仅启动后端（NestJS watch，3001）          |
| `pnpm build`         | 生产构建（utils → frontend + backend）    |
| `pnpm start`         | 启动前端生产服务器                        |
| `pnpm start:backend` | 启动后端生产服务（`node dist/main.js`）   |
| `pnpm typecheck`     | 全仓库 TypeScript 检查                    |
| `pnpm db:push`       | 推送 Schema 到数据库（自动切到 app 目录） |
| `pnpm db:studio`     | 打开 Prisma Studio                        |
| `pnpm lint`          | 代码检查（turbo 逐包执行）                |
| `pnpm format`        | 代码格式化                                |

## Docker 部署

### 全栈部署（推荐）

使用 Docker Compose 同时部署应用和数据库：

```bash
docker compose up -d --build
```

首次启动后，在宿主机执行数据库同步：

```bash
pnpm db:push
```

停止服务：

```bash
docker compose down        # 保留数据
docker compose down -v     # 删除数据卷
```

### 仅部署应用

如使用外部数据库，可单独构建应用镜像：

```bash
docker build -t lyh-next:latest .
docker run -d --name lyh-next -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@<db-host>:5432/lyh-next-db" \
  -e NEXTAUTH_URL="http://your-domain.com" \
  -e NEXTAUTH_SECRET="your-strong-secret" \
  lyh-next:latest
```

### 环境变量对照表

以下为 Docker Compose 中使用的环境变量（与 `.env` 字段对应，仅全栈部署时生效）：

| Docker 环境变量    | 默认值                                               | 说明                     |
| ------------------ | ---------------------------------------------------- | ------------------------ |
| `APP_DATABASE_URL` | `postgresql://postgres:postgres@db:5432/lyh-next-db` | 容器内连接，一般无需修改 |
| `NEXTAUTH_URL`     | `http://localhost:3000`                              | 改为实际域名             |
| `NEXTAUTH_SECRET`  | `please-change-this-secret`                          | 必须替换为强随机字符串   |

## 代码规范

```bash
pnpm lint        # 代码检查
pnpm format      # 代码格式化
```

## 目录结构

仓库为 pnpm workspaces + Turborepo monorepo：

```
apps/
├── frontend/                  # @lyh-next/frontend —— Next.js 应用
│   ├── src/
│   │   ├── app/               # App Router 页面与页面内业务组件
│   │   ├── provider/          # NextAuth Provider
│   │   ├── server/            # auth.ts / prisma.ts
│   │   ├── styles/            # Tailwind 入口与业务样式
│   │   ├── utils/             # 仅应用内使用的工具（clipboard）
│   │   ├── generated/         # Prisma 生成的客户端（勿手改）
│   │   └── middleware.ts
│   ├── prisma/schema.prisma    # 数据库模型定义
│   ├── public/                 # 静态资源
│   ├── .env                    # 环境变量
│   └── next.config.ts
└── backend/                   # @lyh-next/backend —— NestJS 服务
packages/
├── components/                # @lyh-next/components —— shadcn/ui 组件库（源码包）
│   └── src/
│       ├── index.ts           # 统一出口
│       ├── shadcn/            # 组件实现（同功能只保留 shadcn 版本）
│       └── styles/index.css   # 组件库基础样式（主题变量 / dark 变体）
└── utils/                     # @lyh-next/utils —— 格式化函数与 cn（tsdown 构建）
turbo.json                     # 任务编排与缓存
pnpm-workspace.yaml            # workspace、catalog 版本目录与构建白名单
tsconfig.base.json             # 共享 TS 配置
```

包之间依赖方向：`frontend → components → utils`。

组件统一从包名导入，样式由包提供：

```tsx
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@lyh-next/components'
```

```css
/* apps/frontend/src/styles/index.css */
@import 'tailwindcss';
@import '@lyh-next/components/styles.css';
```

## License

MIT License © 2025 lyh
