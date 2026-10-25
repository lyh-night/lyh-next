# Monorepo 改造需求与迁移方案（pnpm workspaces + Turborepo）

> 本文档是**需求与实施规划文档**，不是改造完成后的说明文档。
> 当前仓库仍是单体 Next.js 项目；本文定义「改造为 monorepo」的目标结构、包边界、配置改造、文件迁移映射、验收标准与分阶段实施步骤。
> 文档中的每个路径、引用点、依赖都已在当前仓库中逐一核对（核对结果见附录 A）。

---

## 一、背景、目标与非目标

### 1.1 现状

| 项       | 现状                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 形态     | 单体 Next.js 15.4.6（App Router）+ React 19.1.0 + TypeScript 5.9.2                                                                                |
| 包管理   | pnpm 11.7.0（lockfileVersion 9.0）；`pnpm-workspace.yaml` **只有** `onlyBuiltDependencies` / `ignoredBuiltDependencies`，**没有 `packages` 字段** |
| 应用代码 | `src/app/**`（页面 + `src/app/components/**` 业务组件）、`src/provider`、`src/server`、`src/middleware.ts`、`src/generated/prisma`、`src/styles`  |
| 公共组件 | `src/components/` 共 **20** 个文件：`shadcn/` 15 个、`tooltip/` 3 个（含 `TooltipManager.ts`）、`popover/` 1 个、`portal-to-follow-elem/` 1 个    |
| 工具函数 | `src/utils/` 3 个文件：`classnames.ts`（`cn`）、`clipboard.ts`、`format.ts`                                                                       |
| 构建     | `next build`（`output: 'standalone'`）、`postinstall: prisma generate`、Docker 多阶段构建                                                         |
| 质量工具 | ESLint 9 根级 flat config、Prettier、Husky、lint-staged、Commitlint；**没有** `typecheck` / `test` 脚本                                           |

痛点：公共组件与工具函数被关在应用目录内，无法独立复用/独立构建；没有任务编排与构建缓存；边界靠人肉约定，`src/components` 与 `src/app/components` 的职责区分没有强制手段。

### 1.2 目标

1. 采用 **pnpm workspaces + Turborepo** 重组为 monorepo，形成「应用 / 公共包」两层结构。
2. 抽出两个可复用包：
   - `@lyh-next/utils`：`format.ts` 内容 + `cn`（由 `classnames.ts` 迁入），用 **tsdown** 构建为真实 npm 产物（ESM + d.ts）。
   - `@lyh-next/components`：`src/components` 全部 20 个文件，作为源码包被应用消费。
3. 应用收敛为 `apps/frontend`，只保留页面组装、业务组件、服务端逻辑（auth / prisma）、样式与全局配置。
4. 迁移后：`pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` 在根目录可用，依赖顺序与缓存由 Turborepo 保证；Docker 构建与部署行为保持不变。

### 1.3 非目标（本轮明确不做）

- 不改任何业务逻辑、不改页面行为、不改 UI 表现（纯结构调整）。
- 不把 `src/app/components/**`（workflow / header / ThemeSwitch）包化，它们仍属于应用。
- 不包化 `src/server`、`src/provider`、`src/generated/prisma`、`src/middleware.ts`、`src/utils/clipboard.ts`。
- 不引入测试框架、CI、Changesets、共享 ESLint/TS 配置包、`pnpm catalog`。
- 不发布到 npm：三个包全部 `"private": true`。
- 不更新 `README.md` / `AGENTS.md` / `docs/commands.md`（列为阶段 5 的收尾项，见 §14）。

---

## 二、目标仓库结构

```
lyh-next/
├─ apps/
│  ├─ frontend/                         # @lyh-next/frontend（应用，private）
│     ├─ src/
│     │  ├─ app/                        # 页面 + app 内业务组件（原 src/app 原样搬入）
│     │  │  ├─ api/ auth/ home/ workflow/ example/
│     │  │  └─ components/              # header / ThemeSwitch / workflow（不包化）
│     │  ├─ provider/                   # NextAuthProvider
│     │  ├─ server/                     # auth.ts（NextAuth 会话配置）
│     │  ├─ styles/                     # index/variable/shadcn/custom.css（全局样式唯一来源）
│     │  ├─ utils/                      # clipboard.ts / api.ts（后端地址）
│     │  └─ middleware.ts
│     ├─ public/
│     ├─ components.json                # shadcn CLI 配置（迁入）
│     ├─ next.config.ts
│     ├─ next-env.d.ts
│     ├─ postcss.config.js
│     ├─ tsconfig.json
│     ├─ .env / .env.example
│     └─ package.json
│  └─ backend/                          # @lyh-next/backend（NestJS，private）
│     ├─ src/
│     │  ├─ main.ts                     # 全局前缀 /api、校验、CORS、Swagger、优雅关闭
│     │  ├─ app.module.ts               # ConfigModule + PrismaModule + HealthModule + AuthModule
│     │  ├─ app.controller.ts/service.ts
│     │  ├─ auth/                       # /api/auth/register、/api/auth/verify-credentials
│     │  ├─ health/                     # GET /api/health
│     │  ├─ prisma/                     # PrismaService（生命周期托管）
│     │  ├─ generated/prisma/           # Prisma Client 生成物，gitignore
│     │  └─ common/{filters,interceptors}/
│     ├─ prisma/schema.prisma           # 数据库模型（唯一归属）
│     ├─ prisma.config.ts
│     ├─ dist/                          # 构建产物，gitignore
│     ├─ .env / .env.example            # DATABASE_URL / PORT / CORS_ORIGINS
│     ├─ Dockerfile
│     ├─ nest-cli.json
│     ├─ tsconfig.json / tsconfig.build.json
│     └─ package.json
├─ packages/
│  ├─ utils/                            # @lyh-next/utils（private，tsdown 构建）
│  │  ├─ src/{index.ts,format.ts,classnames.ts}
│  │  ├─ dist/                          # 构建产物，gitignore
│  │  ├─ tsdown.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json
│  └─ components/                       # @lyh-next/components（private，源码包）
│     ├─ src/index.ts                   # 统一出口
│     ├─ src/shadcn/                    # 组件实现（同功能只留 shadcn）
│     ├─ src/styles/index.css           # 组件库基础样式
│     ├─ tsconfig.json
│     └─ package.json
├─ docs/                                # 文档留在根
├─ .husky/                              # 钩子留在根
├─ package.json                         # 私有 workspace 根（不含业务依赖）
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ eslint.config.js
├─ prettier.config.js
├─ commitlint.config.js
├─ Dockerfile
├─ docker-compose.yml
├─ .dockerignore
├─ README.md
└─ AGENTS.md
```

---

## 三、技术选型与版本

| 项         | 版本 / 取值      | 说明                                                                                              |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| pnpm       | `11.7.0`         | 已安装；根 `package.json` 增加 `"packageManager": "pnpm@11.7.0"`                                  |
| Node       | 本地 `v22.21.1`  | tsdown 0.23.x 要求 `^22.18.0 \|\| ^24.11.0 \|\| >=26`，**必须**在根 `engines.node` 声明 `>=22.18` |
| Turborepo  | `turbo@^2.11.9`  | 根 devDependency，任务编排 + 本地缓存                                                             |
| tsdown     | `tsdown@^0.23.1` | `@lyh-next/utils` 的构建器（ESM + d.ts）                                                          |
| Next.js    | `15.4.6`         | 不变；新增 `transpilePackages` 与 `outputFileTracingRoot`                                         |
| React      | `19.1.0`         | 全仓库唯一实例，由单一版本保证                                                                    |
| TypeScript | `^5.9.2`         | 各包 devDependency（tsdown 的 dts 依赖 tsc）                                                      |

> 版本以本次 `registry.npmjs.org` 实测为准（turbo 2.11.9、tsdown 0.23.1）；实施时若已有更新版本，取当时的兼容最新版，并回写本文档。

### 3.1 运行环境要求的变化

- `engines.node` 从「README 写的 >=18」提升到 **>=22.18**（tsdown 硬性要求）。
- Dockerfile 基础镜像 `node:22-alpine` 需确保解析到 22.18+（建议实施时钉为 `node:22.21-alpine` 或更高，避免浮标漂移）。
- 根目录 `package.json` 增加 `"private": true`、`"packageManager"`、`"engines"`。

---

## 四、包职责与依赖边界

### 4.1 三个包

| 包                     | 类型                 | 内容                                                                                                                | 构建                                   |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `@lyh-next/utils`      | 库包（编译产物）     | `formatNumber` / `formatFileSize` / `formatTime` / `downloadFile`（来自 `format.ts`）+ `cn`（来自 `classnames.ts`） | `tsdown` → `dist/*.js` + `dist/*.d.ts` |
| `@lyh-next/components` | 库包（**源码直出**） | `shadcn/*`（15）、`tooltip/*`（3，含 `TooltipManager`）、`popover`、`portal-to-follow-elem`，共 20 文件             | 不编译；仅 `tsc --noEmit` 做类型校验   |
| `@lyh-next/frontend`   | 应用（private）      | 页面、业务组件、provider、server、prisma、styles、middleware、`utils/clipboard.ts`                                  | `next build`（standalone）             |

### 4.2 依赖方向（强约束）

```
apps/frontend ──▶ packages/components ──▶ packages/utils
      │
      └──────────▶ packages/utils
```

禁止：

- `packages/*` 依赖 `apps/frontend`；
- `packages/*` 引用应用别名 `@/*`；
- `packages/utils` 依赖 `packages/components`；
- 包内出现 `server-only` / Prisma / Next 服务端 API（`components` 仅允许 `next-themes` 这类纯客户端依赖）。

### 4.3 为什么 components 是源码包而 utils 是编译包（ADR-002 / ADR-003）

- **components 用源码直出**：包内 20 个文件里有 **13 个**带 `'use client'` 指令（`shadcn/` 11 个、`tooltip/index.tsx`、`portal-to-follow-elem/index.tsx`）、样式全部是 Tailwind class。若用 tsdown 编译成 `dist`，需额外处理指令保留、JSX runtime、Tailwind 扫描路径与 HMR 失效，收益低风险高。源码直出 + `transpilePackages` 是 Turborepo + Next 的主流做法。
- **utils 用 tsdown 编译**：纯函数无 JSX，是最适合验证「真实打包产物」的场景；同时强制我们显式定义 `exports` 与类型产物，为将来真正对外复用打基础。

---

## 五、包规范

### 5.1 `@lyh-next/utils`

**目录**

```
packages/utils/
├─ src/
│  ├─ index.ts          # 出口：export * from './format'; export { cn } from './classnames'
│  ├─ format.ts         # 由 src/utils/format.ts 迁入（内容不变）
│  └─ classnames.ts     # 由 src/utils/classnames.ts 迁入（内容不变，导出 cn）
├─ tsdown.config.ts
├─ tsconfig.json
└─ package.json
```

**package.json（草案）**

```json
{
  "name": "@lyh-next/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "tsdown": "^0.23.1",
    "typescript": "^5.9.2",
    "eslint": "^9.33.0"
  }
}
```

**tsdown.config.ts（草案）**

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  target: 'es2022',
  // 固定产物扩展名，避免 exports 与实际文件名漂移
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
```

**约束与约定**

- 仅 ESM（`type: module`），应用侧由 Next 打包消费，不提供 CJS。
- `sideEffects: false`：禁止顶层副作用（当前 `format.ts` / `classnames.ts` 均满足）。
- `downloadFile` 依赖 `window` / `document`：**只能在 client 组件调用**；`tsconfig` 的 `lib` 保留 `dom`，包内不引入 `server-only` 守卫（保持纯函数），调用约束写入 JSDoc 与 §12 的编码约定。
- `tsconfig.json`：extends 根 `tsconfig.base.json`，`include: ["src"]`，`noEmit: true`（产物由 tsdown 生成，`tsc` 只做类型校验）。

**导出 API 清单（迁移后不变）**

| 导出             | 签名                                               | 来源              |
| ---------------- | -------------------------------------------------- | ----------------- |
| `formatNumber`   | `(num: number \| string) => number \| string`      | `format.ts:6`     |
| `formatFileSize` | `(fileSize: number) => number \| string`           | `format.ts:19`    |
| `formatTime`     | `(seconds: number) => number \| string`            | `format.ts:35`    |
| `downloadFile`   | `(args: { data: Blob; fileName: string }) => void` | `format.ts:46`    |
| `cn`             | `(...inputs: ClassValue[]) => string`              | `classnames.ts:9` |

> 注：`format.ts` 当前在全仓库**没有任何引用**（0 处 import）。迁入包后仅作为可用能力保留，本次改造**不新增调用方**，也不删除它。

### 5.2 `@lyh-next/components`

**目录**

```
packages/components/
├─ src/
│  ├─ index.ts                 # 统一出口（barrel）
│  ├─ shadcn/                  # 15 个 shadcn/ui 组件
│  └─ styles/index.css         # 组件库基础样式（主题变量 + dark 变体 + @theme 映射）
├─ tsconfig.json
└─ package.json
```

**package.json**

```json
{
  "name": "@lyh-next/components",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles/index.css",
    "./shadcn/*": "./src/shadcn/*.tsx"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@lyh-next/utils": "workspace:*",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.2.8",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.562.0",
    "next-themes": "^0.4.6",
    "react-hook-form": "catalog:",
    "sonner": "^2.0.7"
  },
  "devDependencies": {
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "eslint": "^9.33.0",
    "react": "catalog:",
    "react-dom": "catalog:",
    "typescript": "catalog:"
  }
}
```

**导出策略（关键决策）**

- **统一出口**：消费方一律 `import { Button, Tooltip } from '@lyh-next/components'`，不再散落 `./shadcn/xxx` 子路径。`import` 心智负担小，重构（组件换实现/改名）只改包内。
- 保留 `./shadcn/*` 单一通配导出**仅为 shadcn CLI 兼容**（`pnpm dlx shadcn add` 生成的文件路径与内部相对引用），业务代码不应使用。
- `sideEffects` 声明为 `["**/*.css"]`：JS 可被完全 tree-shake，但 CSS 副作用必须保留，否则打包器会误删样式。
- 包内**只保留 shadcn/ui 版本**：同一功能的组件不维护两套。原 `tooltip/`、`popover/`、`portal-to-follow-elem/`（基于 `@floating-ui/react` + `@headlessui/react` 的自研浮层）与 shadcn 的 Tooltip/Popover 功能重复，已删除，应用侧 3 处调用迁移到 `Tooltip/TooltipTrigger/TooltipContent`。
- 删除重复组件后，`@floating-ui/react`、`@headlessui/react`、`@remixicon/react`、`ahooks` 不再被包内使用，已从 `dependencies` 移除（应用侧仍在用，保留在 app 的依赖里）。
- 无 `build` 脚本（源码包）。turbo `build` 只作用于 `utils`、`frontend` 与 `backend`；turbo 允许某个包缺少某任务，缺失即跳过。

**包内引用改造（仅 2 类）**

| 现状                                                    | 改为                                   | 处数 |
| ------------------------------------------------------- | -------------------------------------- | ---- |
| `import { cn } from '@/utils/classnames'`               | `import { cn } from '@lyh-next/utils'` | 17   |
| `from '@/components/shadcn/button'`（`pagination.tsx`） | `from './button'`                      | 1    |
| `from '@/components/shadcn/label'`（`form.tsx`）        | `from './label'`                       | 1    |

**样式契约**

- `src/styles/index.css` 是组件库的基础样式层，只包含：`@custom-variant dark`、`html[data-theme]` 下的设计变量、`@theme inline` 映射。
- 包内**不得** `@import 'tailwindcss'`、不得引入 Tailwind 入口，也不得写业务样式；由宿主应用在 Tailwind 入口按顺序引入：

  ```css
  @import 'tailwindcss';
  @import '@lyh-next/components/styles.css';
  ```

- 应用私有的设计变量（如 workflow 调色板 `variable.css`）与私有 class（`custom.css`）仍留在 `apps/frontend/src/styles/`。
- 组件源码仍需被 Tailwind 扫描：应用入口用 `@source '../../../../packages/components/src/**/*.{ts,tsx}'` 显式纳入。

**tsconfig 要点**：extends 根 `tsconfig.base.json`，`include: ["src"]`，`jsx` 覆盖为 `"react-jsx"`（仅类型校验，不需要 `preserve`）。根 base 不开启 `incremental`，避免各包把 `.tsbuildinfo` 写进包目录或共用同一缓存文件；增量收益由 turbo 的 `typecheck` 缓存提供。

### 5.3 `@lyh-next/frontend`

**package.json（草案，仅列结构与改动的部分）**

```json
{
  "name": "@lyh-next/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@lyh-next/components": "workspace:*",
    "@lyh-next/utils": "workspace:*"
  }
}
```

- 现有 37 个运行时依赖（`dependencies`）+ 20 个 `devDependencies`（Next / Prisma / NextAuth / xyflow / zustand …）**按用途拆分到 app 的 dependencies 与根/app 的 devDependencies**，根 `package.json` 不再持有业务依赖。
- `postinstall: prisma generate` 改为由根统一触发（见 §8.2），app 内保留 `generate` 脚本供手动调用。
- `lint` 从 `next lint` 改为 `eslint .`（原因见 §8.5）。

**next.config.ts（草案）**

```ts
import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  output: 'standalone',
  // 源码包需要被 Next 编译
  transpilePackages: ['@lyh-next/components'],
  // monorepo 下 standalone 必须显式指定追踪根，否则 server.js 目录层级错误
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default nextConfig
```

**tsconfig.json（草案）**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@lyh-next/components/*": ["../../packages/components/src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- `@lyh-next/components/*` 的 paths 映射与包的 `exports` **同指向源码**，双解析结果一致；同时它是 shadcn CLI 能定位写文件目录的前提（见 §8.5）。
- `@lyh-next/utils` **不加** paths：走包的 `exports` → `dist/*.d.ts`，保证「类型看到的就是运行时真正加载的产物」。代价是 app 的 typecheck 依赖 utils 先构建，由 turbo `dependsOn: ["^build"]` 保证。
- 应用自身 `@/*` 别名保持不变，`src/app/components/**` 的 `@/app/components/xxx` 引用不需要改。

---

## 六、文件迁移映射表

| #   | 源（当前）                                                                                 | 目标                                          | 动作                                                                         |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `src/components/**`（20 文件）                                                             | `packages/components/src/**`                  | 移动 + 改 3 类 import（§5.2）                                                |
| 2   | `src/utils/format.ts`                                                                      | `packages/utils/src/format.ts`                | 移动，内容不变                                                               |
| 3   | `src/utils/classnames.ts`                                                                  | `packages/utils/src/classnames.ts`            | 移动，内容不变，由 `index.ts` 导出 `cn`                                      |
| 4   | `packages/utils/src/index.ts`                                                              | —                                             | **新建**（`export * from './format'` + `export { cn } from './classnames'`） |
| 5   | `src/utils/clipboard.ts`                                                                   | `apps/frontend/src/utils/clipboard.ts`        | 留在应用内（非目标）                                                         |
| 6   | `src/app/**`（含 `src/app/components/**`）                                                 | `apps/frontend/src/app/**`                    | 移动，目录结构不变                                                           |
| 7   | `src/provider/`、`src/server/`、`src/middleware.ts`、`src/generated/prisma/`               | `apps/frontend/src/` 对应位置                 | 移动                                                                         |
| 8   | `src/styles/`（4 个 CSS）                                                                  | `apps/frontend/src/styles/`                   | 移动；`index.css` 增加 `@source`（§9）                                       |
| 9   | `public/`、`prisma/`、`prisma.config.ts`                                                   | `apps/frontend/`                              | 移动                                                                         |
| 10  | `next.config.ts`、`next-env.d.ts`、`postcss.config.js`、`components.json`、`tsconfig.json` | `apps/frontend/`                              | 移动 + 改造                                                                  |
| 11  | `.env`、`.env.example`                                                                     | `apps/frontend/`                              | 移动（保证 Next 与 Prisma CLI 的 CWD 一致）                                  |
| 12  | `package.json`                                                                             | 根 + 三个子包 `package.json`                  | 拆分重写                                                                     |
| 13  | `tsconfig.json`                                                                            | `tsconfig.base.json` + 三个子 `tsconfig.json` | 拆分重写                                                                     |
| 14  | `eslint.config.js`、`prettier.config.js`、`commitlint.config.js`、`.husky/`、`lint-staged` | 根（原地）                                    | 小改（§8.5 / §8.6）                                                          |
| 15  | `pnpm-workspace.yaml`、`turbo.json`、`Dockerfile`、`.dockerignore`、`.gitignore`           | 根（原地）                                    | 改造（§8 / §11）                                                             |
| 16  | `docker-compose.yml`、`docs/`、`README.md`、`AGENTS.md`                                    | 根（原地）                                    | 不动（README/AGENTS 见 §14 收尾）                                            |
| 17  | 根残留 `node_modules/`、`.next/`、`tsconfig.tsbuildinfo`、`pnpm-lock.yaml`                 | —                                             | 结束后清理/重装重建                                                          |

---

## 七、导入路径变更清单

### 7.1 全量改写规则

| 旧                                | 新                              | 命中                   |
| --------------------------------- | ------------------------------- | ---------------------- |
| `@/utils/classnames`              | `@lyh-next/utils`               | **22 个文件 / 22 行**  |
| `@/components/shadcn/*`（应用侧） | `@lyh-next/components/shadcn/*` | **10 个文件 / 26 行**  |
| `@/components/tooltip`（应用侧）  | `@lyh-next/components/tooltip`  | **3 个文件 / 3 行**    |
| `@/components/shadcn/*`（包内）   | 相对路径 `./xxx`                | 2 行                   |
| `@/utils/format`                  | `@lyh-next/utils`               | **0 处**（当前无引用） |

### 7.2 `@/utils/classnames` 明细（22 处）

包内（17）：`shadcn/{button,dialog,dropdown-menu,form,hover-card,input,label,pagination,popover,select,switch,table,textarea,tooltip}.tsx`、`popover/index.tsx`、`portal-to-follow-elem/index.tsx`、`tooltip/index.tsx`。

应用内（5）：

- `src/app/components/header/nav/index.tsx`
- `src/app/components/workflow/edge/custom-edge/index.tsx`
- `src/app/components/workflow/handle/node-handle.tsx`
- `src/app/components/workflow/nodes/_base/node.tsx`
- `src/app/components/workflow/operator/control.tsx`

### 7.3 `@lyh-next/components` 明细（10 个应用文件 / 29 行）

`src/app/auth/login/page.tsx`、`src/app/auth/register/page.tsx`、`src/app/example/page.tsx`、`src/app/layout.tsx`、`src/app/components/header/avatar/index.tsx`、`src/app/components/workflow/panel/panel-content.tsx`、`src/app/components/workflow/operator/{control,node-selector,workflow-operation}.tsx`、`src/app/components/workflow/nodes/_base/node.tsx`。

> 注：`src/app/components/workflow/**` 内部相互引用（`../../BaseIcon`、`../../store/index`）全为相对路径，不受影响。

### 7.4 迁移后残留检查

```bash
grep -rn "@/components\|@/utils/classnames\|@/utils/format" apps packages || echo "OK: 无残留"
```

---

## 八、根配置改造清单

### 8.1 `pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - packages/*

# pnpm 11 起用 allowBuilds 控制依赖安装脚本（旧的 onlyBuiltDependencies 已失效）
allowBuilds:
  '@prisma/client': true
  '@prisma/engines': true
  prisma: true
  sharp: false
  '@tailwindcss/oxide': false
```

> **实施修正（原规划此处有误）**：pnpm 11 已移除 `onlyBuiltDependencies` / `ignoredBuiltDependencies`，改用 `allowBuilds: { <pkg>: boolean }`。沿用旧键会导致 `prisma` / `@prisma/engines` 的安装脚本被忽略，pnpm 直接以 `ERR_PNPM_IGNORED_BUILDS` 让 `pnpm install` 失败。

### 8.2 根 `package.json`

```json
{
  "name": "lyh-next",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.7.0",
  "engines": { "node": ">=22.18" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "start": "pnpm --filter @lyh-next/frontend run start",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write .",
    "generate": "pnpm --filter @lyh-next/frontend run generate",
    "db:push": "pnpm --filter @lyh-next/frontend run db:push",
    "db:studio": "pnpm --filter @lyh-next/frontend run db:studio",
    "prepare": "husky",
    "postinstall": "pnpm --filter @lyh-next/frontend run generate"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.8.1",
    "@commitlint/config-conventional": "^19.8.1",
    "@eslint/js": "^9.33.0",
    "@next/eslint-plugin-next": "^15.4.7",
    "eslint": "^9.33.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.4",
    "husky": "^9.1.7",
    "lint-staged": "^16.1.5",
    "prettier": "^3.6.2",
    "prettier-plugin-tailwindcss": "^0.6.14",
    "turbo": "^2.11.9",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.40.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

要点：

- `postinstall` 用 `--filter` 转到 app 内执行，保证 Prisma 生成时 CWD 是 `apps/frontend`（`prisma.config.ts` 用 `dotenv/config` 读 app 内 `.env`）。若 pnpm 的 install-script 策略在 CI 上拦截递归调用，备选方案是：app `package.json` 自带 `postinstall: prisma generate`（workspace 项目自身的生命周期脚本不受 `onlyBuiltDependencies` 限制），或显式 `pnpm generate`。
- `typecheck` 是**新增**脚本，`AGENTS.md`「当前未定义 typecheck / test」的表述需在收尾阶段同步修正。
- 根 devDependency 不再包含 `next`/`react`/`prisma` 等业务依赖；`prisma` CLI 归 app（`postinstall` 通过 filter 调用）。

### 8.3 `turbo.json`

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "globalEnv": ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "NEXT_PUBLIC_APP_NAME"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- `dev` 的 `dependsOn: ["^build"]` 是为了启动 `next dev` 前先有 `utils/dist`（app 通过 exports 读 dist 类型与运行时）。
- `build`/`typecheck` 的 `^build` 保证顺序：`utils.build` → `frontend.build`；`components` 没有 build 任务，被自动跳过。
- `outputs` 同时声明 `.next/**` 与 `dist/**`，turbo 缓存才能命中（`!.next/cache/**` 排除缓存目录自身）。
- `globalEnv` 让依赖环境变量的产物不会误用缓存。

### 8.4 `tsconfig.base.json`（新建）+ 子 tsconfig

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "allowJs": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true
  }
}
```

- app：`extends` + `plugins: [next]` + `paths`（§5.3）。
- utils：`include: ["src"]`；`noEmit: true`（产物由 tsdown 出）；`lib` 需含 `dom`（`downloadFile` 用 `window`/`document`）。
- components：`include: ["src"]`；`jsx: "react-jsx"`（仅校验）。

### 8.5 ESLint / Prettier / shadcn

- `eslint.config.js` 保留在根（ESLint 9 会从各包 CWD 向上查找配置，包内执行 `eslint .` 即可命中根配置）。改造点：
  - **插件注册保持无 `files` 作用域**（`{ plugins: { '@next/next': nextPlugin } }`），否则 Next 构建会告警「Next.js plugin was not detected」；
  - Next 规则本身用 `files: ['apps/frontend/**/*.{ts,tsx}']` 限定作用域，避免对 `packages/*` 施加 App Router 规则；
  - 新增 ignores：`**/.next/**`、`**/dist/**`、`**/src/generated/**`、`**/node_modules/**`。
- 应用 `lint` 由 `next lint` 改为 `eslint .`：`next lint` 的扫描根固定为应用目录且 Next 15 已将其标记为弃用路线，统一用 `eslint .` 让包与应用的 lint 行为一致。
- `prettier.config.js` 留在根，`format` 只在根跑一次（`prettier --write .`），不放进 turbo 任务，避免多包并行写文件。**必须显式配置 `tailwindStylesheet: './apps/frontend/src/styles/index.css'`**：否则 `prettier-plugin-tailwindcss` 在根目录找不到 Tailwind 入口，会回退到默认排序，导致全仓类名排序与既有代码不一致（实施时出现 28 个文件的排序差异）。
- `apps/frontend/components.json`：`css` 改为 `../../packages/components/src/styles/index.css`（主题变量归属组件库）；aliases 改为
  - `components` → `@lyh-next/components/shadcn`
  - `ui` → `@lyh-next/components/shadcn`
  - `utils` → `@lyh-next/utils`
  - `lib` → `@lyh-next/utils`
  - `hooks` → `@/hooks`

  这依赖 §5.3 中 app tsconfig 的 `@lyh-next/components/*` paths 映射，shadcn CLI 才能把新组件写进 `packages/components/src/shadcn/`。CLI 新增组件后，需手动在 `packages/components/src/index.ts` 补一行 `export * from './shadcn/<name>'`，业务侧才能从统一出口导入。

### 8.6 `.gitignore`（增补）

```gitignore
**/node_modules
**/.next/
**/dist/
**/.turbo/
**/*.tsbuildinfo
/apps/frontend/src/generated/prisma
```

原有 `/src/generated/prisma`、`/node_modules`、`/.next/` 等条目按新结构替换。

---

## 九、样式与 Tailwind 方案（本项目最易踩坑的一环）

Tailwind CSS 4 通过扫描源码提取 class。组件搬到 `packages/components/src` 后已不在应用目录内，**自动探测不保证覆盖**，必须显式声明扫描源：

`apps/frontend/src/styles/index.css`（改造后）

```css
@import 'tailwindcss';
@import 'tw-animate-css';
/* 组件库基础样式：主题变量、dark 变体与 Tailwind 主题映射都收敛在包内 */
@import '@lyh-next/components/styles.css';

/* 组件包源码必须显式纳入扫描，否则组件类会被裁掉 */
@source '../../../../packages/components/src/**/*.{ts,tsx}';

@import './variable.css';
@import './custom.css';
```

- 路径以**该 CSS 文件所在目录**为基准：`src/styles/` → 上四层回到仓库根 → `packages/components/src`。
- `@source` 必须放在依赖包已存在之后生效（迁移顺序：先搬包，再改 CSS）。
- 主题变量分两层：
  - **组件库层**（包内 `styles/index.css`）：`--radius`、`--color-primary` 等 shadcn token 与 `@theme inline` 映射，属于组件的公共契约；
  - **应用层**（app 的 `variable.css`）：workflow 调色板等业务 token。
  - `dark` 变体基于 `html[data-theme='dark']`（`@custom-variant dark`），由组件库统一定义，应用只负责在 `<html>` 上设置 `data-theme`。
- 包内 CSS 通过 `exports["./styles.css"]` 暴露，Tailwind 的 `@import` 解析走包的 exports（与 `@import 'tailwindcss'` 同一套解析）。
- 若将来 components 改为编译产物（`dist`），`@source` 必须同步指向 `dist`，且 `exports`、`transpilePackages` 三处联动修改——这是 §5.2 选择源码包的另一个理由。

---

## 十、环境变量与数据库

| 项                      | 现状                                  | 迁移后                                                          |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------- |
| `.env` / `.env.example` | 根目录                                | `apps/frontend/`（Next dev/build 的 CWD 即 app 目录）           |
| `prisma.config.ts`      | 根                                    | `apps/frontend/`，`import 'dotenv/config'` 自动读 app 内 `.env` |
| `prisma/schema.prisma`  | 根                                    | `apps/frontend/prisma/`                                         |
| Prisma 生成物           | `src/generated/prisma`                | `apps/frontend/src/generated/prisma`（gitignore 路径同步）      |
| `src/server/prisma.ts`  | 相对引用 `../generated/prisma/client` | 相对路径不变，无需改                                            |

约定：

- 所有 Prisma 命令必须经根脚本 `--filter @lyh-next/frontend` 执行，保证 CWD；直接在根目录跑 `prisma` 会读不到 `.env`。
- `docker-compose.yml` 通过环境变量注入 `DATABASE_URL`（`APP_DATABASE_URL` 覆盖），与 `.env` 位置无关，无需改动。
- `prisma` CLI 属于 app 的 devDependencies，不放到根。

---

## 十一、构建与部署

### 11.1 Turborepo 流水线

- `pnpm build` → `utils.build`（tsdown）→ `frontend.build`（next build，standalone）→ 产物 `apps/frontend/.next/standalone/`。
- `pnpm dev` → 先 `utils.build`，再并行 `utils.dev`（`tsdown --watch`）与 `frontend.dev`（`next dev`）。
- 二次构建命中缓存：`utils/dist` 与 `.next` 由 turbo `outputs` 决策。

### 11.2 Dockerfile（改造后的结构）

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat

# 依赖层：只复制 workspace 清单，最大化层缓存
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/utils/package.json ./packages/utils/
COPY packages/components/package.json ./packages/components/
COPY apps/frontend/prisma ./apps/frontend/prisma
COPY apps/frontend/prisma.config.ts ./apps/frontend/prisma.config.ts
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/packages/components/node_modules ./packages/components/node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 保留了 monorepo 目录层级（受 outputFileTracingRoot 控制）
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/apps/frontend/prisma ./apps/frontend/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/frontend/server.js"]
```

关键点（必须与 `outputFileTracingRoot` 保持一致）：

1. `CMD` 路径从 `server.js` 变为 `apps/frontend/server.js`。
2. `.next/static`、`public` 要落到 `apps/frontend/` 下，否则页面无样式/静态资源 404。
3. `deps` 层必须先复制各包 `package.json`，否则 `pnpm install --frozen-lockfile` 与 lockfile 的 importers 不匹配直接失败。
4. 基础镜像需满足 Node ≥ 22.18（建议钉版本号）。

### 11.3 `.dockerignore`（增补）

```
**/node_modules
**/.next
**/dist
**/.turbo
**/*.tsbuildinfo
```

### 11.4 `docker-compose.yml`

无需改动：`app.build.context = .`、环境变量注入方式、`db` 服务与健康检查均与目录结构无关。

---

## 十二、提交钩子与协作约定

- `.husky/pre-commit`（`npx lint-staged`）、`.husky/commit-msg`（`npx --no-install commitlint --edit`）保留在根，git 根未变，路径无需改。
- `lint-staged` 配置放根 `package.json`（见 §8.2），钩子对 `apps/**` 与 `packages/**` 同样生效。
- `commitlint.config.js` 保留在根，type 枚举不变。
- 新增编码约定（写入本文件，后续可同步到 `docs/coding-conventions.md`）：
  1. 包内**禁止**引用应用别名 `@/*`，包内跨文件用相对路径，跨包用包名。
  2. 应用引用公共组件一律用 `@lyh-next/components/<subpath>`，不写深层相对路径（`../../packages/...`）。
  3. 新增可复用组件默认落在 `packages/components/src`；只在单一页面使用的组件留在 `apps/frontend/src/app/components`。
  4. 纯函数工具放 `@lyh-next/utils`；涉及 `window`/`document` 的函数必须在 JSDoc 标注「仅 client 侧调用」。

---

## 十三、验收标准

| #   | 验收项                      | 判定命令 / 方法                                                                                                                 |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 依赖安装成功、lockfile 单份 | `pnpm install`；根仅一份 `pnpm-lock.yaml`，`importers` 含 `.` / `apps/frontend` / `packages/utils` / `packages/components` 四项 |
| 2   | React 单一实例              | `pnpm why react` 只出现 19.1.0；无重复副本                                                                                      |
| 3   | utils 产物正确              | `pnpm --filter @lyh-next/utils build` 后存在 `dist/index.js` 与 `dist/index.d.ts`，且 `exports` 与文件名一致                    |
| 4   | 类型检查通过                | `pnpm typecheck`（turbo 顺序：utils build → app typecheck）                                                                     |
| 5   | Lint 通过                   | `pnpm lint`                                                                                                                     |
| 6   | 生产构建通过                | `pnpm build`；存在 `apps/frontend/.next/standalone/apps/frontend/server.js`                                                     |
| 7   | turbo 缓存生效              | 连续两次 `pnpm build`，第二次 `utils` 命中缓存（FULL TURBO / cache hit）                                                        |
| 8   | 开发态页面正常              | `pnpm dev` 后访问 `/`、`/auth/login`、`/auth/register`、`/example`、`/workflow` 均 200 且主题切换正常                           |
| 9   | 组件样式未丢失              | `/example` 页 Button/Dialog/Select/Tooltip/Pagination 视觉与改造前一致（验证 `@source` 生效）                                   |
| 10  | 数据库脚本可用              | 根目录 `pnpm db:push` 成功（验证 `--filter` + CWD + `.env`）                                                                    |
| 11  | Docker 可用                 | `docker compose up -d --build` 后 `curl -I localhost:3000` 返回 200；容器日志无 Prisma/静态资源错误                             |
| 12  | 无残留旧引用                | `grep -rn "@/components\|@/utils/classnames\|@/utils/format" apps packages` 无输出                                              |
| 13  | 无越界依赖                  | `packages/*/package.json` 不含 `next`；`grep -rn "apps/frontend" packages` 无输出                                               |

---

## 十四、分阶段实施计划

> 每阶段结束都应可 `pnpm install && pnpm build` 通过（或明确说明该阶段尚未跑通的原因），便于逐步回滚。

### 阶段 0：清理与基线（前置）

- 当前工作树有 **20+ 处未提交改动**（`src/styles/*`、`next.config.ts`、`.gitignore`、多个 `shadcn/*.tsx`、`header/avatar`、`workflow/operator`、`workflow/panel` 等）。迁移前必须先提交或 stash，否则移动文件后无法区分「迁移改动」与「既有改动」。
- 记录改造前基线：`pnpm build` 成功、`/example` 页面截图（用于阶段 5 视觉对照）。

### 阶段 1：脚手架

- 新增 `pnpm-workspace.yaml` 的 `packages` 字段、根 `package.json`（§8.2）、`turbo.json`、`tsconfig.base.json`。
- 建立 `apps/frontend`、`packages/{utils,components}` 目录与各自 `package.json`。
- 验收：`pnpm install` 成功，`turbo --version` 可用。

### 阶段 2：抽 `@lyh-next/utils`

- 迁 `format.ts`、`classnames.ts`，新建 `src/index.ts`、`tsdown.config.ts`、`tsconfig.json`。
- 验收：`pnpm --filter @lyh-next/utils build` 产出 `dist/index.js` + `dist/index.d.ts`。

### 阶段 3：抽 `@lyh-next/components`

- 移动 20 个文件，改 3 类 import（§5.2），写 `package.json`（exports / peerDeps / deps）与 `tsconfig.json`。
- 暂不改应用（此时两处并存不影响构建，因为应用仍用 `@/components`）。
- 验收：`pnpm --filter @lyh-next/components typecheck` 通过。

### 阶段 4：应用搬迁与接线

- 移动 `src/**`、`public`、`prisma`、`.env`、配置文件到 `apps/frontend`。
- 改写 22 处 `@/utils/classnames`、26 处 `@/components/shadcn/*`、3 处 `@/components/tooltip`。
- 改 `next.config.ts`（§5.3）、app `tsconfig.json`、`src/styles/index.css`（`@source`）、`components.json`、`eslint.config.js`、`.gitignore`。
- 验收：`pnpm dev` 页面与基线一致；`pnpm build` 产出 standalone。

### 阶段 5：部署与文档收尾

- Dockerfile / `.dockerignore` / 根脚本 `db:*` 验证；`docker compose up -d --build`。
- 同步文档：`README.md`（目录结构、Node 版本、命令）、`AGENTS.md`（文档索引 + 「typecheck 已定义」）、`docs/directory-structure.md`、`docs/commands.md`、`docs/tech-stack.md`（新增 pnpm workspace / Turborepo / tsdown）。
- 清理根残留：`node_modules`、`.next`、`tsconfig.tsbuildinfo`，重新 `pnpm install`。

---

## 十五、风险与应对

| #   | 风险                                                                              | 影响                                     | 应对                                                                                                            |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Tailwind 自动探测漏扫 `packages/components/src`                                   | 组件样式被裁，`/example` 视觉崩坏        | 显式 `@source`；验收项 9 兜底                                                                                   |
| 2   | standalone 目录层级错误                                                           | 容器启动后 404 / 找不到 static           | `outputFileTracingRoot` 与 `CMD`/`COPY` 三处同步；验收项 6/11                                                   |
| 3   | React 出现两份实例                                                                | Hooks 报错（Invalid hook call）          | peerDependencies + 单一版本；验收项 2                                                                           |
| 4   | utils 未构建就被 app 解析                                                         | 类型报错或运行时找不到 `dist`            | turbo `dependsOn: ["^build"]`；utils `dev` 用 `--watch`                                                         |
| 5   | 双解析不一致（components 的 tsconfig paths 指向源码，utils 走 exports 指向 dist） | 改了源码但类型/运行看到旧产物            | 约定明确：components 双指向源码、utils 只走 exports 且必须构建；出问题可删除 components 的 paths 退回纯 exports |
| 6   | tsdown 产物文件名与 `exports` 漂移                                                | 报 `Cannot find module`                  | `outExtensions` 固定 `.js/.d.ts`，构建后核对 `dist/`                                                            |
| 7   | 首次 `pnpm typecheck` 暴露既有类型错误                                            | 新增脚本立刻红灯                         | 先跑一次基线，只修与迁移相关的错误，其余单独记录成任务（不扩大本次范围）                                        |
| 8   | `pnpm-workspace.yaml` 白名单被误删                                                | Prisma/Tailwind 安装脚本被拦截，构建失败 | §8.1 明确保留原两项                                                                                             |
| 9   | 根 `postinstall` 递归/被拦截                                                      | Prisma Client 未生成，全部报错           | 备选：app 自带 `postinstall`，或显式 `pnpm generate`                                                            |
| 10  | 迁移中工作树已有未提交改动被覆盖                                                  | 丢失改动                                 | 阶段 0 强制先提交/stash                                                                                         |
| 11  | 应用 `lint` 从 `next lint` 迁到 `eslint .` 后规则变化                             | 可能出现新告警                           | Next 插件规则限定 `apps/frontend/**`；先跑基线对比                                                              |
| 12  | `downloadFile` 在服务端被误用                                                     | 运行时 `window is not defined`           | JSDoc 标注 + 编码约定（§12.4）                                                                                  |

---

## 十六、决策记录（ADR 摘要）

| ID      | 决策                                                                           | 背景                                                        | 后果 / 替代方案                                                                                                                           |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | 目录用 `apps/*` + `packages/*`（而非 `app/` + `package/`）                     | 与 Turborepo 生态默认约定一致，工具与文档默认行为即如此     | 无额外配置；替代方案需在 turbo/CI 中显式指定目录，收益为 0                                                                                |
| ADR-002 | `@lyh-next/components` 为源码包（`exports` 直出 `.tsx` + `transpilePackages`） | 20 个文件里 13 个带 `'use client'`，样式全是 Tailwind class | HMR 保留、无需构建；代价是消费方必须能编译 TS（本项目就是 Next，天然满足）。替代方案（tsdown 编译）需处理指令保留与 `@source` 指向 `dist` |
| ADR-003 | `@lyh-next/utils` 用 tsdown 编译为 ESM + d.ts                                  | 需要真实打包产物验证 exports/类型链路；纯函数无 JSX，风险低 | 类型与运行严格对应；代价是 app 的 typecheck 依赖 utils 先构建（turbo 已保证）                                                             |
| ADR-004 | `cn`（`classnames.ts`）并入 `@lyh-next/utils`                                  | 17 个组件文件依赖 `cn`，包内无法解析应用别名 `@/*`          | `cn` 单一来源，应用侧 5 处 + 包内 17 处统一改 `@lyh-next/utils`；替代方案（组件包内置一份 cn）会产生两份实现                              |
| ADR-005 | 不设 components barrel 入口                                                    | client 组件集中导出会破坏 `'use client'` 边界与按需加载     | 子路径导入更啰嗦，但边界清晰；替代方案（barrel）在 App Router 下易导致整包进 client graph                                                 |
| ADR-006 | 全局样式与主题 token 只留在 app                                                | 主题基于 `html[data-theme]`，属应用级约定                   | 包保持纯净、可测试；代价是包不能自带样式，需依赖消费方提供 token                                                                          |
| ADR-007 | 三个包全部 `private: true`，不引入 Changesets                                  | 当前无对外发布需求                                          | 版本统一 `0.0.0` + `workspace:*`；将来发布再引入 Changesets（§17）                                                                        |
| ADR-008 | `format.ts` 迁入 utils 但暂不新增调用方                                        | 当前 0 引用，属预留能力                                     | 保留可复用性，不制造「为迁移而写业务代码」的噪音                                                                                          |

---

## 十七、后续演进（本轮不做）

1. `pnpm catalog` 统一 React / Next / TS 版本（消除各包版本漂移）。
2. `packages/eslint-config`、`packages/tsconfig` 抽共享配置（当前集中在根，够用）。
3. 为 `@lyh-next/utils` 引入测试（vitest），并在 turbo 中加 `test` 任务。
4. Changesets（若 utils/components 需要对外发布）。
5. CI：GitHub Actions + turbo remote cache（`TURBO_TOKEN` / `TURBO_TEAM`）。
6. 文档索引更新：`AGENTS.md` 挂载本文、`docs/commands.md` 重写为根命令表、`docs/directory-structure.md` 换成 monorepo 结构。
7. 视 `src/app/components/workflow` 的复用诉求，评估是否再抽 `@lyh-next/workflow-editor`（优先级低，耦合 Zustand + xyflow）。

---

## 十八、实施记录（2026-10-20 落地）

### 18.1 落地结果

| 项          | 结果                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| 目录结构    | `apps/frontend`、`packages/components`、`packages/utils` 已就位，git 以 rename 方式保留历史                             |
| 包名        | `@lyh-next/frontend`、`@lyh-next/components`、`@lyh-next/utils`                                                         |
| import 改写 | 应用侧 34 处（`@lyh-next/utils` 5 处 + `@lyh-next/components` 29 处），包内 3 类共 19 处                                |
| utils 产物  | `dist/index.js` + `dist/index.d.ts`，与 `exports` 一致                                                                  |
| 构建        | `pnpm build` 通过，产物 `apps/frontend/.next/standalone/apps/frontend/server.js`                                        |
| 校验        | `pnpm lint`、`pnpm typecheck` 全绿；`pnpm dev` 下 `/auth/login`、`/auth/register` 返回 200，受保护路由正确 307 到登录页 |
| 样式        | 构建产物 CSS 已包含组件包独有类（如 `caption-bottom`），`@source` 生效                                                  |

### 18.2 与规划的差异（均为实施中证伪或补充）

| #   | 规划写法                                                | 实际落地                                                                             | 原因                                                                                                                               |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `onlyBuiltDependencies` / `ignoredBuiltDependencies`    | `allowBuilds: { pkg: boolean }`                                                      | pnpm 11 已移除旧键，沿用会让 `pnpm install` 直接失败（`ERR_PNPM_IGNORED_BUILDS`）                                                  |
| 2   | `prettier.config.js` 内容不变                           | 增加 `tailwindStylesheet`，并归一化 28 个文件的类名顺序                              | 根目录缺少 Tailwind 入口时插件回退默认排序，与既有排序冲突                                                                         |
| 3   | components 只声明 peerDependencies                      | 额外在 devDependencies 钉 `react`/`react-dom@19.1.0`                                 | 否则 pnpm 把 peer 解析为更新的 19.3.1，与 app 的 19.1.0 形成双实例，`react-hook-form` 类型不兼容                                   |
| 4   | `outputFileTracingRoot: path.join(__dirname, '../../')` | 用 `process.cwd()` 推导仓库根                                                        | `next.config.ts` 在 ESM/CJS 两种加载路径下 `__dirname`/`import.meta.dirname` 都不可靠；turbo 保证 CWD 为包目录                     |
| 5   | Next 插件规则用 `files` 作用域                          | 插件**注册**保持全局，仅**规则**用 `files` 作用域                                    | 只做规则作用域会让 Next 构建告警「Next.js plugin was not detected」                                                                |
| 6   | 依赖版本以锁定为准                                      | 锁文件重建后 `^` 依赖升到最新兼容版（Prisma 7.1.0→7.10.1、xyflow 12.8.4→12.12.0 等） | 旧 lockfile 只含单个 importer，无法复用；xyflow 12.10+ 把拖拽事件改为 DOM `MouseEvent \| TouchEvent`，已相应调整 3 个 handler 签名 |

### 18.3 顺带修复的既有阻塞问题

迁移前 `pnpm build` 在 HEAD 上本就无法通过，实施中按最小改动修复（均与业务逻辑无关）：

1. `src/app/home/page.tsx` 用了 layout 签名（`children` 参数），Next 类型校验报「invalid default export」→ 改为页面签名，DOM 输出不变。
2. `eslint.config.js` 未忽略 `src/generated/**`，Prisma 生成物触发大量 `prettier/prettier` → 增加全局 ignores。
3. `src/components/popover/index.tsx` 用 `a && b()` 短路语句当语句（`no-unused-expressions`）→ 改为等价 `if`。
4. `help-line/index.tsx` 引用未导入的 `useStore`，且 store 未接入 `createHelpLineSlice` → 接入 slice 并改用 `useWorkflowStore`。
5. `cloneElement` 泛型与 `children.props` 展开在 React 19 类型下报错 → 补 `ReactElement<HtmlContentProps>` 与外层断言。
6. `/auth/login` 的 `useSearchParams()` 缺少 Suspense 边界 → 用 `<Suspense fallback={null}>` 包裹表单主体。

### 18.4 未验证项

- **未跑 `docker build`**：实施环境无 docker daemon。替代验证：按 Dockerfile 的 runner 布局把 `static`、`public` 拷到 `apps/frontend/.next/standalone/apps/frontend/` 下，直接执行 `node apps/frontend/.next/standalone/apps/frontend/server.js`：`/auth/login` 返回 200、`/home` 307 到登录页、CSS 与 favicon 均 200，且 CSS 内含组件包独有类名。仍需在具备 Docker 的机器上跑一次 `docker compose up -d --build` 做最终确认。
- `pnpm db:push` 未实测（本地未启动 PostgreSQL 容器）；已用 `prisma validate` 验证 `prisma.config.ts` 与 `.env` 在应用目录下正确加载，`prisma generate` 在 `pnpm install` 的 postinstall 中成功执行。
- `pnpm dev` 已验证路由与中间件行为，未做逐页视觉回归（样式正确性以产物 CSS 中组件包类名存在为证据）。

### 18.5 第二轮优化（组件包收敛）

| 项         | 调整                                                                                                              | 结果                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 导出方式   | 子路径导出（6 个 `exports` 键）→ 统一出口 `@lyh-next/components`                                                  | 应用侧 29 处导入合并为 11 处；包内仅保留 `./shadcn/*` 通配供 CLI 使用                                                                                           |
| 样式包     | 新增 `packages/components/src/styles/index.css`，`exports["./styles.css"]` 暴露                                   | 主题变量 / `@custom-variant dark` / `@theme inline` 从 app 迁入包内；app 入口改为 `@import '@lyh-next/components/styles.css'`，删除 `src/styles/shadcn.css`     |
| 组件去重   | 删除 `tooltip/`、`popover/`、`portal-to-follow-elem/`（与 shadcn Tooltip/Popover 重复）                           | 应用 3 处调用迁移到 `Tooltip` + `TooltipTrigger asChild` + `TooltipContent`；包依赖移除 `@floating-ui/react`、`@headlessui/react`、`@remixicon/react`、`ahooks` |
| 版本一致   | `pnpm-workspace.yaml` 增加 `catalog`，react / react-dom / 类型包 / react-hook-form / typescript 统一用 `catalog:` | `pnpm install` 后仅 1 个 react@19.1.0、1 个 react-hook-form@7.90.0，无 19.3.1 残留                                                                              |
| 构建产物   | `/example` First Load JS 15.5 kB → 5.61 kB，`/workflow` 98.5 kB → 90.3 kB                                         | 去重与 tree-shake 生效                                                                                                                                          |
| 增量编译   | 移除 `tsconfig.base.json` 的 `incremental`                                                                        | 不再产生 `packages/components/tsconfig.tsbuildinfo`；typecheck 增量收益由 turbo 缓存承担                                                                        |
| 缓存正确性 | `turbo.json` 增加 `globalDependencies`（tsconfig.base / eslint / prettier / lockfile）                            | 改根配置会正确失效缓存；连续两次 build 恢复 `FULL TURBO`                                                                                                        |

> 关于 `tsconfig.tsbuildinfo`：它是 TypeScript 增量编译的缓存文件（记录上次编译的文件指纹与诊断信息），由 `incremental: true` 触发生成，可安全删除。此前它出现在 `packages/components/` 下，是因为 `tsc --noEmit` 默认把缓存写到 tsconfig 同目录；该文件被 `.gitignore` 的 `**/*.tsbuildinfo` 覆盖，不进入版本库。

---

## 十九、`apps/backend` 基础设施（NestJS）

### 19.1 定位

`@lyh-next/backend` 是独立的后端服务包（NestJS 12 + Express），与前端通过 HTTP 通信，不依赖 `packages/*`。
采用**独立的 tsconfig**（`module: nodenext` + 装饰器 + 真实 emit），不 extends `tsconfig.base.json`（base 面向 bundler + `noEmit`，两者编译模型不同）。

### 19.2 脚本

```json
{
  "dev": "nest start --watch",
  "build": "nest build",
  "start": "node dist/main.js",
  "start:prod": "node dist/main.js",
  "start:debug": "nest start --debug --watch",
  "lint": "eslint src",
  "typecheck": "tsc --noEmit -p tsconfig.json",
  "format": "prettier --write \"src/**/*.ts\""
}
```

- `dev` 供 turbo 的 persistent 任务识别；`pnpm dev` 会同时拉起 frontend(3000)、backend(3001) 与 utils watch。
- **无 `test` 脚本**，仓库不引入测试框架（同步移除了 vitest / supertest / @nestjs/testing 及其配置）。

### 19.3 运行时基础设施

| 能力     | 实现                                                                                                              | 位置                   |
| -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 配置     | `@nestjs/config`，`isGlobal`、`cache`，env 优先级 `.env.local` → `.env`                                           | `app.module.ts`        |
| 全局前缀 | `app.setGlobalPrefix('api')`                                                                                      | `main.ts`              |
| 参数校验 | 全局 `ValidationPipe`（`whitelist` + `transform` + `forbidNonWhitelisted`）                                       | `main.ts`              |
| CORS     | `CORS_ORIGINS` 逗号分隔，默认 `http://localhost:3000`，`credentials: true`                                        | `main.ts`              |
| 错误结构 | 全局 `HttpExceptionFilter`：`{ statusCode, message, error, path, timestamp }`，非 `HttpException` 按 500 记录堆栈 | `common/filters/`      |
| 访问日志 | 全局 `LoggingInterceptor`：`METHOD path status 耗时ms`                                                            | `common/interceptors/` |
| 健康检查 | `GET /api/health` → `{ status, uptime, timestamp, version }`                                                      | `health/`              |
| 服务信息 | `GET /api` → `{ name, version, environment }`                                                                     | `app.controller.ts`    |
| API 文档 | `@nestjs/swagger`，`GET /api/docs`，`addBearerAuth()` 预置                                                        | `main.ts`              |
| 优雅关闭 | `app.enableShutdownHooks()`，响应 `SIGTERM`                                                                       | `main.ts`              |

### 19.4 端口与路由约定

- 后端 **3001**（前端占用 3000），可用 `PORT` 覆盖。
- 所有路由带 `/api` 前缀；文档固定 `/api/docs`（`SwaggerModule.setup` 的路径是绝对路径，不受全局前缀影响）。

### 19.5 环境变量

`.env.example`（不入库 `.env`，代码全部有默认值）：

```bash
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
```

### 19.6 与 workspace 的对齐

- 删除脚手架自带的 `package-lock.json`，依赖统一由 pnpm lockfile 管理。
- 删除包内 `.gitignore`（根已覆盖 `node_modules/`、`**/dist/`、`*.tsbuildinfo`、`.env`）。
- 关闭 `incremental`，`nest build` 不再在包根留下 `tsconfig.build.tsbuildinfo`；增量收益交给 turbo 缓存。
- lint 统一为根 ESLint flat config（移除 `oxlint`），并去掉源码分号以符合根 Prettier 配置。
- 移除 `@nestjs/observe`（需 appKey/appSecret 的 SaaS 观测）与 `@nestjs/mau` + `nest deploy`（托管部署）。
- TypeScript 保持 `^6.0.2`：`@nestjs/schematics@12` 按 TS 6 解析，**不并入 catalog**（catalog 里是 5.9，供前端/packages 使用），属于已知的版本差异。
- `@scarf/scarf`（Swagger UI 的匿名统计脚本）在 `allowBuilds` 中显式禁止执行。

### 19.7 Docker

`apps/backend/Dockerfile`（构建上下文为仓库根）：

- `deps` / `prod-deps`：只复制根清单 + 四个 `package.json`，分别安装全量依赖与 `--prod` 依赖；
- `builder`：`pnpm --filter @lyh-next/backend build`；
- `runner`：`node:22-alpine`，非 root，`CMD ["node","dist/main.js"]`，`EXPOSE 3001`。

`docker-compose.yml` 新增 `backend` 服务（`3001:3001`，`CORS_ORIGINS` 可覆盖）。

### 19.8 未验证项

- Docker 镜像未实跑（环境无 docker daemon）；Dockerfile 的路径已与 `nest build` 产物（`dist/main.js`）对齐。
- `pnpm dev` 双端并行只验证了 turbo 任务编排（backend 的 `dev` 为 watch 模式，单独启动已验证）。

---

## 二十、数据与认证迁移至 backend

> 目标：把数据库与认证的归属从 `apps/frontend` 收敛到 `apps/backend`，前端只做 UI 与会话。

### 20.1 迁移映射

| 原位置                                             | 新位置                                                | 说明                                                                    |
| -------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/frontend/prisma/schema.prisma`               | `apps/backend/prisma/schema.prisma`                   | generator 输出仍为 `../src/generated/prisma`（现在指向 backend）        |
| `apps/frontend/prisma.config.ts`                   | `apps/backend/prisma.config.ts`                       | `schema` / `migrations` 路径不变，相对 backend 目录                     |
| `apps/frontend/src/server/prisma.ts`               | `apps/backend/src/prisma/prisma.service.ts`           | 改为 Nest `@Injectable()`，由 `PrismaModule`（`@Global`）托管连接与断开 |
| `apps/frontend/src/generated/prisma`               | `apps/backend/src/generated/prisma`                   | 生成物，已从 git 与镜像中移除                                           |
| `apps/frontend/src/app/api/auth/register/route.ts` | `apps/backend/src/auth/`（`POST /api/auth/register`） | 改用 DTO 校验 + 统一异常结构                                            |
| `apps/frontend/src/server/auth.ts` 中的 DB 访问    | `POST /api/auth/verify-credentials`                   | NextAuth 的 `authorize()` 改为 fetch 后端                               |

### 20.2 认证边界（方案 A）

```text
浏览器 ──signIn('credentials')──▶ Next.js /api/auth/*(NextAuth, JWT 会话)
                                      │ 服务端 fetch
                                      ▼
                          NestJS POST /api/auth/verify-credentials
                                      │
                                      ▼
                                   PostgreSQL
```

- **NextAuth 仍留在前端**：`middleware.ts` 的 `getToken`、`signIn`/`signOut`、`SessionProvider` 都依赖它，迁走需要重做 cookie 域与中间件鉴权。
- 前端已删除 `PrismaAdapter`（JWT 策略下无必要）、`signIn` 中的 Google 分支（该 provider 从未注册）与 `jwt` 回调里的 `trigger === 'update'` 数据库查询。
- 注册接口改为浏览器直连后端，前端通过 `src/utils/api.ts` 的 `apiUrl()` 拼接 `NEXT_PUBLIC_API_URL`。
- `authorize()` 使用 `BACKEND_URL`（服务端地址，Docker 内为 `http://backend:3001`）；网络异常按登录失败处理（返回 `null`），不把异常抛给 NextAuth。

### 20.3 接口一览

| 方法 | 路径                           | 用途                                    |
| ---- | ------------------------------ | --------------------------------------- |
| GET  | `/api`                         | 服务信息                                |
| GET  | `/api/health`                  | 健康检查                                |
| GET  | `/api/docs`                    | Swagger                                 |
| POST | `/api/auth/register`           | 注册（201；邮箱重复 409；参数非法 400） |
| POST | `/api/auth/verify-credentials` | 凭据校验（200 返回用户档案；失败 401）  |

### 20.4 依赖与环境变量归属

- 后端新增：`@prisma/client`、`@prisma/adapter-pg`、`pg`、`bcryptjs`、`dotenv`，devDependencies 增加 `prisma`。
- 前端移除：上述全部，以及 `@auth/prisma-adapter`；`generate` / `db:push` / `db:studio` 脚本同步迁到后端。
- 根脚本 `generate` / `db:push` / `db:studio` 改为 `pnpm --filter @lyh-next/backend`。
- 根 `postinstall` 改为 `node scripts/generate-prisma.mjs`：schema 或 prisma CLI 不存在时跳过（供 Docker 的 deps/`--prod` 阶段复用）。
- `DATABASE_URL` 移入 `apps/backend/.env`；前端仅保留 `NEXTAUTH_*`、`NEXT_PUBLIC_API_URL`、`BACKEND_URL`。

### 20.5 验证记录

| 项                                  | 结果                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:push`（backend）           | `The database is already in sync with the Prisma schema`                                                               |
| `POST /api/auth/register`           | 201 创建用户；重复邮箱 409 `该邮箱已被注册`；密码 < 6 位 400                                                           |
| `POST /api/auth/verify-credentials` | 正确 200（含 `hasAccess`/`role`）；错误 401                                                                            |
| NextAuth 登录链路                   | 取 CSRF → `POST /api/auth/callback/credentials` 302 → `/api/auth/session` 返回带 `role`/`isAdmin` 的会话 → `/home` 200 |
| 依赖隔离                            | 前端 `pnpm why @prisma/client` 为空                                                                                    |
| `pnpm build`                        | 3/3，二次 `FULL TURBO`                                                                                                 |

### 20.6 附带修复

- `NextAuth` 增加 `trustHost: true`：自托管/Docker 下没有 Vercel 的可信 Host 推断，缺失时会报 `UntrustedHost`（本轮在生产构建验证时暴露）。

---

## 附录 A：现状核对数据（本次实测）

| 事实                           | 数据                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components` 文件数        | 20（`shadcn/` 15、`tooltip/` 3、`popover/` 1、`portal-to-follow-elem/` 1）                                                                                                                   |
| 带 `'use client'` 的组件文件   | 13（`shadcn/` 11 个：dialog、dropdown-menu、form、hover-card、label、popover、select、sonner、switch、table、tooltip；另 `tooltip/index.tsx`、`portal-to-follow-elem/index.tsx`）            |
| `@/utils/classnames` 引用      | 22 个文件 / 22 行（包内 17、应用 5）                                                                                                                                                         |
| `@/components/*` 应用侧引用    | 10 个文件 / 29 行（`shadcn/*` 26 行 + `tooltip` 3 行）                                                                                                                                       |
| `@/components/*` 包内侧引用    | 2 行（`pagination.tsx`→button、`form.tsx`→label）                                                                                                                                            |
| `@/utils/format` 引用          | 0 处                                                                                                                                                                                         |
| `src/components` 外部依赖聚合  | `@floating-ui/react`、`@headlessui/react`、9 个 `@radix-ui/*`、`@remixicon/react`、`ahooks`、`class-variance-authority`、`lucide-react`、`next-themes`、`react-hook-form`、`sonner`、`react` |
| 包内是否引用 `next/*`          | 否（仅 `next-themes`）                                                                                                                                                                       |
| `pnpm-workspace.yaml`          | 仅 `onlyBuiltDependencies`（prisma 3 项）+ `ignoredBuiltDependencies`（`@tailwindcss/oxide`、`sharp`），**无 `packages` 字段**                                                               |
| pnpm / lockfileVersion         | 11.7.0 / 9.0（`autoInstallPeers: true`）                                                                                                                                                     |
| 根 `package.json` 现有 scripts | `build`/`dev`/`start`/`lint`/`format`/`postinstall`/`prepare`/`db:push`/`db:studio`（**无 `typecheck`、无 `test`**）                                                                         |
| 现有全局样式入口               | `src/styles/index.css`（`@import tailwindcss` + `tw-animate-css` + 3 个本地 CSS）                                                                                                            |
| 主题机制                       | `html[data-theme]` + `@theme inline`；`next-themes` 的 `attribute="data-theme"`                                                                                                              |
| 现有构建                       | `output: 'standalone'`，Docker 多阶段，`CMD ["node","server.js"]`                                                                                                                            |
| 工作树状态                     | 改造前存在 20+ 处未提交改动（见阶段 0）                                                                                                                                                      |
