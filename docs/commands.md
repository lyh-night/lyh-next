# 常用命令

> 执行命令前，以 `package.json` 中实际存在的 `scripts` 为准。

---

## 开发

| 命令           | 说明                                              |
| -------------- | ------------------------------------------------- |
| `pnpm install` | 安装依赖，并在 `postinstall` 中生成 Prisma Client |
| `pnpm dev`     | 启动开发服务器                                    |
| `pnpm build`   | 生产构建                                          |
| `pnpm start`   | 启动生产服务                                      |
| `pnpm lint`    | 执行 lint                                         |
| `pnpm format`  | 格式化代码                                        |

---

## 数据库

| 命令             | 说明                          |
| ---------------- | ----------------------------- |
| `pnpm db:push`   | 将 Prisma schema 同步到数据库 |
| `pnpm db:studio` | 打开 Prisma Studio            |

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

以下命令当前没有在 `package.json` 中定义，除非先补充脚本，否则不要作为检查步骤执行：

- `pnpm typecheck`
- `pnpm test`
