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
      server/            # auth.ts / prisma.ts
      styles/            # 全局样式（Tailwind 入口）
      utils/             # 仅应用内使用的工具（clipboard）
      generated/         # Prisma 生成物（自动生成，勿手改）
      middleware.ts
    prisma/              # schema.prisma
    public/              # 静态资源
    .env                 # 环境变量（Next 与 Prisma CLI 共同读取）
    next.config.ts
    tsconfig.json
    components.json      # shadcn CLI 配置
  packages/
    components/          # @lyh-next/components（源码包）
      src/shadcn/        # shadcn/ui 组件
      src/tooltip/
      src/popover/
      src/portal-to-follow-elem/
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
- 不引入全局 CSS、不定义主题变量（主题 token 由 app 的 `src/styles` 提供）
- 通过子路径导入：`@lyh-next/components/shadcn/button`

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

全局样式唯一来源：

- `index.css` 为 Tailwind 入口，含针对 `packages/components/src` 的 `@source`
- 主题变量与 shadcn token 在此定义

### apps/frontend/prisma

数据库 Schema 定义；`.env` 与 Prisma CLI 都在应用目录下执行。

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
