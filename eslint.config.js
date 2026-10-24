import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import nextPlugin from '@next/eslint-plugin-next'
import globals from 'globals'

export default [
  // 全局忽略（生成物与构建产物不参与 lint）
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/src/generated/**',
      'next-env.d.ts',
    ],
  },

  // JS 推荐规则
  js.configs.recommended,

  // TS 推荐规则
  ...tseslint.configs.recommended,

  // Node 脚本与根配置文件运行在 Node 环境（console / process 等全局）
  {
    files: ['scripts/**/*.{js,mjs,cjs}', '*.config.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // Next.js 插件注册（规则仅作用于应用包，避免对 packages 施加 App Router 规则）
  {
    plugins: {
      '@next/next': nextPlugin,
    },
  },
  {
    files: ['apps/frontend/**/*.{js,jsx,ts,tsx}'],
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules, // 包含 web vitals 规则
    },
  },

  // Prettier 规则集
  prettierConfig,

  // Prettier 插件集成 (让 ESLint 报出格式问题)
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // 自定义规则（可选）
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
