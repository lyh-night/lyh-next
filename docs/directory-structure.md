# 目录结构

> 详细说明 monorepo 的目录组织和各目录职责。

---

## 目录总览

```
apps/
  frontend/              # @lyh-next/frontend
    src/
      app/               # App Router 页面 + app 内业务组件
      provider/          # NextAuthProvider
      server/            # auth.ts（NextAuth 会话配置）
      styles/            # 全局样式（Tailwind 入口）
      utils/             # 应用内工具（clipboard / api 后端地址）
      middleware.ts
    public/              # 静态资源
    .env                 # NextAuth 与后端地址相关变量
    next.config.ts
    tsconfig.json
    components.json      # shadcn CLI 配置
  backend/               # @lyh-next/backend（NestJS，独立服务）
    src/
      main.ts            # 启动：/api 前缀、校验、CORS、Swagger、优雅关闭
      app.module.ts      # ConfigModule + PrismaModule + HealthModule + AuthModule
      app.controller.ts  # GET /api
      app.service.ts
      auth/              # register / verify-credentials
      health/            # GET /api/health
      prisma/            # PrismaService（连接托管）
      generated/prisma/  # Prisma Client 生成物（勿手改）
      common/            # filters（统一错误）/ interceptors（访问日志）
    prisma/schema.prisma # 数据库模型（唯一归属）
    prisma.config.ts
    .env / .env.example  # DATABASE_URL / PORT / CORS_ORIGINS
    Dockerfile           # 构建上下文为仓库根
    nest-cli.json
    tsconfig.json
    tsconfig.build.json
packages/
    components/          # @lyh-next/components（源码包）
      src/index.ts       # 统一出口（barrel）
      src/shadcn/        # shadcn/ui 组件（唯一实现来源）
      src/styles/index.css # 组件库基础样式（主题变量 + dark 变体 + @theme 映射）
    utils/               # @lyh-next/utils（tsdown 构建）
      src/index.ts
      src/format.ts
      src/classnames.ts
      dist/              # 构建产物
turbo.json
pnpm-workspace.yaml
tsconfig.base.json
eslint.config.js
prettier.config.js
commitlint.config.js
docs/
Dockerfile
docker-compose.yml
```

---

## 依赖方向

```
apps/frontend → packages/components → packages/utils
apps/frontend → packages/utils
apps/backend  → 独立（不依赖 packages/*）
```

禁止：

- `packages/*` 依赖 `apps/frontend`
- `packages/*` 引用应用别名 `@/*`
- 包内出现 Prisma / `server-only` / Next 服务端 API

---

## 各目录职责

### apps/frontend/src/app

页面入口，仅负责：

- 页面布局
- 页面组合
- 数据获取

禁止放置复杂业务逻辑。

### apps/frontend/src/app/components

App Router 业务页面内使用的组件，例如 workflow、header、ThemeSwitch。

要求：

- 仅服务于 app 内页面组合
- 业务范围应清晰
- 可复用到全局时迁移到 `packages/components`

### apps/frontend/src/app/api

Route Handler 入口。

要求：

- 保持请求处理清晰
- 复杂业务逻辑下沉到 server / service 层
- 不在 route 文件中堆叠大量业务代码

### packages/components

公共组件（源码包，应用直接消费 `.tsx`）。

要求：

- 可复用、无业务耦合、不直接请求接口
- **同一功能只保留 shadcn/ui 版本**，不维护重复的自研浮层组件
- 统一从包名导入：`import { Button, Tooltip } from '@lyh-next/components'`（`./shadcn/*` 子路径仅留给 shadcn CLI）
- 主题变量与 `@custom-variant dark` 由包内 `src/styles/index.css` 提供，通过 `@lyh-next/components/styles.css` 引入
- 新增 shadcn 组件后，在 `src/index.ts` 补一行 re-export
- 包内禁止引入 Tailwind 入口，也禁止写业务样式

### packages/utils

纯函数工具包，用 tsdown 构建为 ESM + d.ts。

要求：

- 无副作用（`sideEffects: false`），可 tree-shake
- 含 `window`/`document` 的函数必须在 JSDoc 标注「仅 client 侧调用」
- 通过 `@lyh-next/utils` 引入，禁止深路径引用 `src`

### apps/frontend/src/provider

Provider 组件，例如 NextAuthProvider。

### apps/frontend/src/server

服务器端逻辑：

- auth.ts（认证配置）
- prisma.ts（数据库客户端）

### apps/frontend/src/styles

样式入口与业务样式：

- `index.css`：Tailwind 入口，依次引入 `tailwindcss`、`tw-animate-css`、`@lyh-next/components/styles.css`，并用 `@source` 纳入组件包源码
- `variable.css`：workflow 调色板等**应用私有** token
- `custom.css`：应用私有 class（如 `.custom-icon`）

> shadcn 主题 token 已迁入 `packages/components/src/styles/index.css`，app 内不再重复定义。

### apps/backend

NestJS 12 后端服务，独立进程、独立 tsconfig（`module: nodenext` + 装饰器 + emit），不 extends `tsconfig.base.json`。

要求：

- 所有路由带 `/api` 前缀；默认端口 3001
- 新模块放在 `src/<module>/`，DTO 用 `class-validator` 装饰器，校验由全局 `ValidationPipe` 兜底
- 错误统一走 `HttpExceptionFilter` 的结构，不要在 controller 里手写响应格式
- 环境变量通过 `@nestjs/config` 读取，新增变量同步更新 `.env.example`
- 业务逻辑与 Prisma 等基础设施放在独立模块，不要写进 `app.controller.ts`
- 数据库访问统一走 `PrismaService`（`@Global` 的 `PrismaModule`），不要自行 `new PrismaClient()`
- Prisma schema、生成物与 `DATABASE_URL` 都在本包内；`generate` / `db:push` / `db:studio` 由本包提供
- **不引入测试框架**（无 `*.spec.ts` / vitest / supertest）

### apps/frontend/src/server

- `auth.ts`：NextAuth 配置与会话（JWT），凭据校验委托给后端 `POST /api/auth/verify-credentials`
- 前端**不直连数据库**，不要在此重新引入 Prisma

### 根目录配置

- `turbo.json`：任务编排（`build` / `dev` / `lint` / `typecheck`）
- `pnpm-workspace.yaml`：workspace 范围与 `allowBuilds` 安装脚本白名单
- `tsconfig.base.json`：各包共享的编译选项

### Dockerfile / docker-compose.yml

Docker 部署配置。

要求：

- 应用镜像使用 Next.js standalone output
- `outputFileTracingRoot` 指向仓库根，因此运行路径为 `apps/frontend/server.js`
- Compose 中应用容器连接数据库时使用 `APP_DATABASE_URL` 覆盖默认连接
- 后端镜像为 `apps/backend/Dockerfile`（构建上下文为仓库根），Compose 服务名 `backend`，端口 `3001:3001`
