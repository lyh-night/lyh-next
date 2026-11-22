/**
 * 文件预览工作区：上限与 MIME 映射。
 *
 * 与前端 `components/files/constants.ts` 的提示保持一致；服务端是最终裁决方，
 * 前端预校验只用于提前失败。
 */
export const FILE_LIMITS = {
  /** 工作区保留时长：24 小时 */
  ttlMs: 24 * 60 * 60 * 1000,
  /** 单个文件上限：20 MiB */
  maxFileBytes: 20 * 1024 * 1024,
  /** 单个工作区总大小上限：200 MiB */
  maxTotalBytes: 200 * 1024 * 1024,
  /** 单个工作区文件数上限 */
  maxFiles: 500,
  /** 同一用户同时保留的工作区数量上限 */
  maxWorkspacesPerUser: 10,
  /** 目录树最多返回的条目数 */
  maxTreeEntries: 2000,
  /** 文本单页最多行数 */
  maxLinesPerPage: 2000,
  /** 文本单页最多字节数 */
  maxPageBytes: 2 * 1024 * 1024,
} as const

/** 有变更风险时清理过期工作区的间隔（30 分钟） */
export const PURGE_INTERVAL_MS = 30 * 60 * 1000

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/plain; charset=utf-8',
  htm: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
}

/** 图片与 PDF 是浏览器内可直接呈现的类型；其余按附件处理 */
const INLINE_MIME_PREFIXES = ['image/', 'application/pdf']

/**
 * 根据扩展名推断 Content-Type。
 * 未知类型统一为 octet-stream（不猜测，避免浏览器把上传内容当 HTML 执行）。
 */
export function contentTypeForPath(path: string): string {
  const extension = path.includes('.') ? path.split('.').pop()?.toLowerCase() : undefined
  return (extension && MIME_BY_EXTENSION[extension]) || 'application/octet-stream'
}

export function isInlineContentType(contentType: string): boolean {
  return INLINE_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix))
}
