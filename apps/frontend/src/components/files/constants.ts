/** 文件预览：与后端 `files.constants.ts` 对齐的前端提示与分类 */

export const FILE_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxFiles: 500,
  /** 文本单页行数（后端上限 2000，这里取一半减少首屏等待） */
  pageLines: 1000,
} as const

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'])

export const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])

/** 常见代码后缀（未知后缀按纯文本展示，与 DSH 的兜底策略一致） */
export const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'vue',
  'svelte',
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'rb',
  'swift',
  'dart',
  'sh',
  'bash',
  'zsh',
  'sql',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'env',
  'dockerfile',
  'makefile',
  'lock',
  'gradle',
  'properties',
  'diff',
  'patch',
  'proto',
  'graphql',
  'gql',
  'lua',
  'r',
  'scala',
  'zig',
])

/**
 * 明确无法按文本预览的二进制后缀（与 DSH 的不可预览列表同思路）。
 * 命中时显示“不支持预览”，不发起读取。
 */
export const UNVIEWABLE_EXTENSIONS = new Set([
  // 视频
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'flv',
  'wmv',
  'm4v',
  // 音频
  'mp3',
  'wav',
  'flac',
  'ogg',
  'm4a',
  'aac',
  'wma',
  'opus',
  // 压缩包
  'zip',
  'gz',
  'tgz',
  'bz2',
  'xz',
  'zst',
  '7z',
  'rar',
  'tar',
  'jar',
  // 文档（本版不做 Office 转换）
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'pages',
  'numbers',
  // 可执行 / 二进制
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'o',
  'class',
  'pyc',
  'wasm',
  // 字体
  'ttf',
  'otf',
  'woff',
  'woff2',
])

export type PreviewKind = 'text' | 'code' | 'markdown' | 'image' | 'pdf' | 'unsupported'

export function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path
  const index = name.lastIndexOf('.')
  if (index <= 0 || index === name.length - 1) return ''
  return name.slice(index + 1).toLowerCase()
}

export function previewKindFor(path: string): PreviewKind {
  const extension = extensionOf(path)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
  if (UNVIEWABLE_EXTENSIONS.has(extension)) return 'unsupported'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  return 'text'
}

/** Shiki 语言名（与 `components/chat/markdown/highlighter.ts` 的映射对齐） */
export function languageForPath(path: string): string {
  const extension = extensionOf(path)
  const aliases: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    html: 'html',
    htm: 'html',
    h: 'c',
    hpp: 'cpp',
    rs: 'rust',
    rb: 'ruby',
    kt: 'kotlin',
    cs: 'csharp',
    csproj: 'xml',
    gql: 'graphql',
    md: 'markdown',
    markdown: 'markdown',
  }
  return aliases[extension] ?? extension
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
