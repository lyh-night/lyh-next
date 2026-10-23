# @lyh-next/backend

Lyh Next 的后端服务，基于 **NestJS 12 + Express**（TypeScript，ESM）。

## 快速开始

在**仓库根目录**执行（workspace 依赖需要统一安装）：

```bash
pnpm install
pnpm dev:backend        # 等价于 pnpm --filter @lyh-next/backend run dev
```

默认监听 <http://localhost:3001>。

## 环境变量

复制模板并按需修改（`.env` 不入库，未配置时全部使用默认值）：

```bash
cp apps/backend/.env.example apps/backend/.env
```

| 变量           | 默认值                  | 说明                           |
| -------------- | ----------------------- | ------------------------------ |
| `PORT`         | `3001`                  | 监听端口（前端占用 3000）      |
| `NODE_ENV`     | `development`           | 运行环境                       |
| `CORS_ORIGINS` | `http://localhost:3000` | 允许跨域的来源，多个用逗号分隔 |

## 路由

| 方法 | 路径          | 说明                                              |
| ---- | ------------- | ------------------------------------------------- |
| GET  | `/api`        | 服务信息（名称 / 版本 / 环境）                    |
| GET  | `/api/health` | 健康检查（status / uptime / timestamp / version） |
| GET  | `/api/docs`   | Swagger 接口文档                                  |

错误统一返回：

```json
{
  "statusCode": 404,
  "message": "Cannot GET /api/nope",
  "error": "Not Found",
  "path": "/api/nope",
  "timestamp": "2026-10-23T12:34:22.744Z"
}
```

## 命令

| 命令                                            | 说明                                |
| ----------------------------------------------- | ----------------------------------- |
| `pnpm dev:backend`                              | watch 模式启动                      |
| `pnpm --filter @lyh-next/backend run build`     | 编译到 `dist/`                      |
| `pnpm --filter @lyh-next/backend run start`     | 运行编译产物（`node dist/main.js`） |
| `pnpm --filter @lyh-next/backend run lint`      | ESLint（使用根配置）                |
| `pnpm --filter @lyh-next/backend run typecheck` | `tsc --noEmit`                      |

> 仓库不包含自动化测试，也没有 `test` 脚本。

## 目录

```
src/
├─ main.ts                     # 启动：前缀 /api、校验、CORS、Swagger、优雅关闭
├─ app.module.ts               # ConfigModule + HealthModule
├─ app.controller.ts           # GET /api
├─ app.service.ts
├─ health/                     # GET /api/health
└─ common/
   ├─ filters/http-exception.filter.ts     # 统一错误结构
   └─ interceptors/logging.interceptor.ts  # 访问日志
```

## Docker

镜像构建上下文是仓库根目录：

```bash
docker build -f apps/backend/Dockerfile -t lyh-next-backend .
docker run -p 3001:3001 -e CORS_ORIGINS=http://localhost:3000 lyh-next-backend
# 或随 compose 一起启动
docker compose up -d --build backend
```
