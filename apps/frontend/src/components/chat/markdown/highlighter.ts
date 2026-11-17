'use client'

import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>
/** loadLanguage 可接受的输入（语法包动态导入模块即满足该类型） */
type LanguageInput = Parameters<Highlighter['loadLanguage']>[0]

let highlighterPromise: Promise<Highlighter> | null = null
const loadedLanguages = new Set<string>()

/** 代码围栏语言 → Shiki 语法包（按需懒加载；未收录的语言回退纯文本展示） */
const LANGUAGE_IMPORTS: Record<string, () => Promise<LanguageInput>> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
}

/** 常见语言别名归一化 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  shellscript: 'bash',
  yml: 'yaml',
  md: 'markdown',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  rb: 'ruby',
  docker: 'dockerfile',
  gql: 'graphql',
  json5: 'json',
  jsonc: 'json',
}

function resolveLanguage(lang: string): string | null {
  const name = lang.trim().toLowerCase()
  if (!name) return null
  const mapped = LANGUAGE_ALIASES[name] ?? name
  return LANGUAGE_IMPORTS[mapped] ? mapped : null
}

/**
 * 懒加载 Shiki 核心（JS 正则引擎，免 WASM）后高亮代码。
 * 主题双注册 github-light / github-dark：浅色输出内联色，深色走 --shiki-dark 变量。
 * 任一步失败返回 null，由调用方回退纯文本。
 */
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  const language = resolveLanguage(lang)
  if (!language || !code) return null

  try {
    highlighterPromise ??= createHighlighterCore({
      themes: [
        import('shiki/dist/themes/github-light.mjs'),
        import('shiki/dist/themes/github-dark.mjs'),
      ],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    })
    const highlighter = await highlighterPromise

    if (!loadedLanguages.has(language)) {
      await highlighter.loadLanguage(await LANGUAGE_IMPORTS[language]())
      loadedLanguages.add(language)
    }

    return highlighter.codeToHtml(code, {
      lang: language,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    })
  } catch {
    return null
  }
}
