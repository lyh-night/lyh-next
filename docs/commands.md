# 常用命令

> 执行命令前，以 `package.json` 中实际存在的 `scripts` 为准。以下命令默认在**仓库根目录**执行。

---

## 开发

| 命令                 | 说明                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `pnpm install`       | 安装依赖，并在 `postinstall` 中生成 Prisma Client                        |
| `pnpm dev`           | 启动开发环境（turbo 先构建 utils，再并行 watch + next dev + nest watch） |
| `pnpm dev:frontend`  | 仅启动前端（3000）                                                       |
| `pnpm dev:backend`   | 仅启动后端（3001，watch 模式）                                           |
| `pnpm build`         | 生产构建（utils → frontend + backend，带 turbo 缓存）                    |
| `pnpm start`         | 启动前端生产服务                                                         |
| `pnpm start:backend` | 启动后端生产服务（`node dist/main.js`）                                  |
| `pnpm lint`          | 逐包执行 ESLint                                                          |
| `pnpm typecheck`     | 逐包执行 TypeScript 检查（依赖 utils 先构建）                            |
| `pnpm format`        | 全仓库 Prettier 格式化                                                   |

---

## 数据库

| 命令             | 说明                                     |
| ---------------- | ---------------------------------------- |
| `pnpm db:push`   | 将 Prisma schema 同步到数据库（backend） |
| `pnpm db:studio` | 打开 Prisma Studio                       |
| `pnpm generate`  | 重新生成 Prisma Client                   |

> 以上脚本通过 `pnpm --filter @lyh-next/backend` 切到后端目录执行：schema、`.env` 与 Prisma CLI 都在 `apps/backend`。

---

## 包级命令

| 命令                                           | 说明                 |
| ---------------------------------------------- | -------------------- |
| `pnpm --filter @lyh-next/utils build`          | 构建工具包到 `dist/` |
| `pnpm --filter @lyh-next/utils dev`            | tsdown watch 模式    |
| `pnpm --filter @lyh-next/components typecheck` | 公共组件类型检查     |
| `pnpm --filter @lyh-next/frontend build`       | 仅构建应用           |
| `pnpm --filter @lyh-next/backend dev`          | 后端 watch 模式      |
| `pnpm --filter @lyh-next/backend build`        | 后端编译到 `dist/`   |
| `pnpm --filter @lyh-next/backend typecheck`    | 后端类型检查         |

---

## 后端

| 命令                                  | 说明                                       |
| ------------------------------------- | ------------------------------------------ |
| `pnpm dev:backend`                    | 开发模式启动，默认 <http://localhost:3001> |
| `curl localhost:3001/api/health`      | 健康检查                                   |
| `open http://localhost:3001/api/docs` | Swagger 文档                               |

> 后端环境变量见 `apps/backend/.env.example`（`PORT` / `NODE_ENV` / `CORS_ORIGINS`），未配置时使用默认值。

---

## Docker

| 命令                                                            | 说明                               |
| --------------------------------------------------------------- | ---------------------------------- |
| `docker compose up -d --build`                                  | 构建并启动前端、后端与 PostgreSQL  |
| `docker compose exec app pnpm db:push`                          | 容器内同步数据库结构               |
| `docker compose down`                                           | 停止 Docker Compose 服务           |
| `docker compose down -v`                                        | 停止服务并删除数据库卷             |
| `docker build -f apps/backend/Dockerfile -t lyh-next-backend .` | 单独构建后端镜像（上下文为仓库根） |

---

## 当前未定义的脚本

- `pnpm test`：仓库尚未引入测试框架，不要作为检查步骤执行。
