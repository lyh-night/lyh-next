# lyh-next

基于 Next.js + @xyflow/react + Zustand + TailwindCSS 构建的可视化工作流编排系统。

## 技术栈

- Next.js - React 全栈框架
- @xyflow/react (React Flow)
- Zustand - 管理全局状态（节点、边、编辑状态等）
- TailwindCSS - 原子化 CSS 框架
- ESLint - 代码规范检查
- Prettier - 代码风格统一
- Husky - Git Hook 管理
- Lint-Staged - 提交前检测暂存区代码
- Commitlint - 提交信息规范

## 后续计划

- 增加连线标签、条件分支节点、增加连线辅助线
- 增加优化撤销/重做功能、支持查看操作历史
- 引入右键菜单与快捷键操作

## 预览

![screenshot](./docs/image.png)

## 安装

克隆项目后，执行：

```bash
pnpm install
```

### 启动项目

开发模式：

```bash
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm start
```

### 代码规范

ESLint & Prettier

执行代码检查：

```bash
pnpm lint
```

执行代码格式化：

```bash
pnpm format
```

## 目录结构

```bash
lyh-next
├── .husky/                # Git hooks 配置
├── .vscode/               # vscode 配置
├── public/                # 静态资源
├── src/
│   ├── app/               # Next.js App Router 页面
│   └── styles/            # 全局样式（Tailwind）
├── .editorconfig
├── .gitignore
├── commitlint.config.js  # commitlint 配置
├── eslint.config.js      # ESLint 配置（Flat Config）
├── next-env.d.ts
├── next.config.ts
├── package.json
├── pnpm-lock.ymal
├── postcss.config.js      # postcss 配置
├── prettier.config.js     # Prettier 配置
├── README.md
└── tsconfig.json
```

## 推荐工具

- VSCode 插件：
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense

## License

MIT License © 2025 lyh
