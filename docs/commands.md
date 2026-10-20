# 常用命令

> 执行命令前，以 `package.json` 中实际存在的 `scripts` 为准。以下命令默认在**仓库根目录**执行。

---

## 开发

| 命令             | 说明                                                          |
| ---------------- | ------------------------------------------------------------- |
| `pnpm install`   | 安装依赖，并在 `postinstall` 中生成 Prisma Client             |
| `pnpm dev`       | 启动开发服务器（turbo 先构建 utils，再并行 watch + next dev） |
| `pnpm build`     | 生产构建（utils → frontend，带 turbo 缓存）                   |
| `pnpm start`     | 启动生产服务                                                  |
| `pnpm lint`      | 逐包执行 ESLint                                               |
| `pnpm typecheck` | 逐包执行 TypeScript 检查（依赖 utils 先构建）                 |
| `pnpm format`    | 全仓库 Prettier 格式化                                        |

---

## 数据库

| 命令             | 说明                          |
| ---------------- | ----------------------------- |
| `pnpm db:push`   | 将 Prisma schema 同步到数据库 |
| `pnpm db:studio` | 打开 Prisma Studio            |
| `pnpm generate`  | 重新生成 Prisma Client        |

> 以上脚本通过 `pnpm --filter @lyh-next/frontend` 切到应用目录执行，保证 `.env` 与 Prisma CLI 的 CWD 正确。

---

## 包级命令

| 命令                                           | 说明                 |
| ---------------------------------------------- | -------------------- |
| `pnpm --filter @lyh-next/utils build`          | 构建工具包到 `dist/` |
| `pnpm --filter @lyh-next/utils dev`            | tsdown watch 模式    |
| `pnpm --filter @lyh-next/components typecheck` | 公共组件类型检查     |
| `pnpm --filter @lyh-next/frontend build`       | 仅构建应用           |

---

## Docker

| 命令                                   | 说明                                 |
| -------------------------------------- | ------------------------------------ |
| `docker compose up -d --build`         | 构建并启动 Next.js 应用和 PostgreSQL |
| `docker compose exec app pnpm db:push` | 容器内同步数据库结构                 |
| `docker compose down`                  | 停止 Docker Compose 服务             |
| `docker compose down -v`               | 停止服务并删除数据库卷               |

---

## 当前未定义的脚本

- `pnpm test`：仓库尚未引入测试框架，不要作为检查步骤执行。
