/** 文件工作区与目录树的接口类型（与后端 files 模块保持一致） */

export interface WorkspaceMeta {
  id: string
  name: string
  fileCount: number
  totalBytes: number
  createdAt: string
  expiresAt: string
}

export interface TreeEntry {
  /** 相对工作区根的路径，统一 / 分隔 */
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
}

export interface TreeResponse {
  entries: TreeEntry[]
  truncated: boolean
}

export interface TextPage {
  path: string
  offset: number
  lines: number
  text: string
  eof: boolean
  size: number
}

/** 待上传项：path 保留文件夹的相对结构 */
export interface UploadEntry {
  file: File
  path: string
}
