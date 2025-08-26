import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  // JS 推荐规则
  js.configs.recommended,

  // TS 推荐规则
  ...tseslint.configs.recommended,

  // Next.js 推荐规则
  {
    plugins: {
      '@next/next': nextPlugin,
    },
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
