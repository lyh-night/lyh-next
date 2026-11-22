import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createReadStream, promises as fs } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { ApiCode } from '../common/errors/api-code.js'
import { ApiException } from '../common/errors/api.exception.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { contentTypeForPath, FILE_LIMITS, PURGE_INTERVAL_MS } from './files.constants.js'
import type { ReadFileQueryDto } from './dto/read-file-query.dto.js'

/** Multer 内存存储上传的文件（不引入 @types/multer，只声明用到的字段） */
export interface UploadedFile {
  buffer?: Buffer
  size: number
  originalname: string
  mimetype: string
}

export interface FileEntry {
  /** 相对工作区根的路径，统一用 / 分隔 */
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
}

export interface WorkspaceView {
  id: string
  name: string
  fileCount: number
  totalBytes: number
  createdAt: Date
  expiresAt: Date
}

export interface TextPage {
  path: string
  offset: number
  lines: number
  text: string
  eof: boolean
  size: number
}

export interface FileBytes {
  /** 绝对路径，由控制器读取后流式返回 */
  absolutePath: string
  size: number
  contentType: string
}

interface WorkspaceRow {
  id: string
  userId: string
  name: string
  fileCount: number
  totalBytes: number
  createdAt: Date
  expiresAt: Date
}

/**
 * 上传文件工作区服务。
 *
 * 设计要点（对应 docs/features/files.md）：
 * - 元信息落 Postgres，文件内容只落盘，正文不进数据库；
 * - 所有路径都是「相对工作区根」的路径，入口统一做目录穿越校验；
 * - 只读：没有编辑/覆盖接口，上传是唯一写入点；
 * - 过期清理：创建后 24 小时，由启动时的定时器批量清理。
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name)
  private readonly storageRoot: string
  private readonly locks = new Map<string, Promise<unknown>>()
  private purgeTimer?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.storageRoot = resolve(config.getOrThrow<string>('FILES_STORAGE_DIR'))
  }

  onModuleInit() {
    // 启动后先清一次，再按固定间隔清理；unref 不阻止进程退出
    void this.purgeExpired()
    this.purgeTimer = setInterval(() => void this.purgeExpired(), PURGE_INTERVAL_MS)
    this.purgeTimer.unref()
  }

  async create(userId: string, name?: string): Promise<WorkspaceView> {
    const active = await this.prisma.fileWorkspace.count({
      where: { userId, expiresAt: { gt: new Date() } },
    })
    if (active >= FILE_LIMITS.maxWorkspacesPerUser) {
      throw new ApiException(
        ApiCode.FILE_LIMIT_EXCEEDED,
        `同时最多保留 ${FILE_LIMITS.maxWorkspacesPerUser} 个临时文件夹，请稍后再试`,
        429,
      )
    }

    const cleanedName = name?.trim().slice(0, 80) || '上传的文件夹'
    const expiresAt = new Date(Date.now() + FILE_LIMITS.ttlMs)
    const workspace = await this.prisma.fileWorkspace.create({
      data: { userId, name: cleanedName, expiresAt },
    })

    await fs.mkdir(this.workspaceDir(workspace), { recursive: true })

    return this.toView(workspace)
  }

  async detail(userId: string, id: string): Promise<WorkspaceView> {
    return this.toView(await this.requireWorkspace(userId, id))
  }

  async upload(
    userId: string,
    id: string,
    relativePath: string,
    file: UploadedFile | undefined,
  ): Promise<FileEntry> {
    if (!file?.buffer) {
      throw new ApiException(ApiCode.INVALID_PARAMS, '缺少上传文件', 400)
    }
    if (file.size > FILE_LIMITS.maxFileBytes) {
      throw new ApiException(
        ApiCode.FILE_TOO_LARGE,
        `单个文件不能超过 ${FILE_LIMITS.maxFileBytes / 1024 / 1024} MB`,
        413,
      )
    }

    const workspace = await this.requireWorkspace(userId, id)
    const safePath = this.normalizeRelativePath(relativePath)

    // 同一工作区的上传串行化：配额计数与旧文件替换必须是原子的
    return this.withLock(workspace.id, async () => {
      // 计数必须在锁内重新读取，否则并发上传会基于同一份旧快照互相覆盖
      const current = await this.requireWorkspace(userId, id)
      const absolutePath = this.absolutePath(current, safePath)
      const existing = await this.existingFileSize(absolutePath)
      const nextCount = current.fileCount + (existing === null ? 1 : 0)
      const nextTotal = current.totalBytes + file.size - (existing ?? 0)

      if (nextCount > FILE_LIMITS.maxFiles) {
        throw new ApiException(
          ApiCode.FILE_LIMIT_EXCEEDED,
          `最多上传 ${FILE_LIMITS.maxFiles} 个文件`,
          400,
        )
      }
      if (nextTotal > FILE_LIMITS.maxTotalBytes) {
        throw new ApiException(
          ApiCode.FILE_LIMIT_EXCEEDED,
          `文件夹总大小不能超过 ${FILE_LIMITS.maxTotalBytes / 1024 / 1024} MB`,
          400,
        )
      }

      await fs.mkdir(dirname(absolutePath), { recursive: true })
      await fs.writeFile(absolutePath, file.buffer as Buffer)

      await this.prisma.fileWorkspace.update({
        where: { id: current.id },
        data: { fileCount: nextCount, totalBytes: nextTotal },
      })

      return {
        path: safePath,
        name: basename(safePath),
        type: 'file' as const,
        size: file.size,
      }
    })
  }

  async tree(userId: string, id: string): Promise<{ entries: FileEntry[]; truncated: boolean }> {
    const workspace = await this.requireWorkspace(userId, id)
    const root = this.workspaceDir(workspace)
    const entries: FileEntry[] = []
    let truncated = false

    const walk = async (directory: string, prefix: string): Promise<void> => {
      const dirents = await fs.readdir(directory, { withFileTypes: true })
      // 目录优先，其次按自然序（数字按数值比较）
      dirents.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
      })

      for (const dirent of dirents) {
        if (entries.length >= FILE_LIMITS.maxTreeEntries) {
          truncated = true
          return
        }
        // 跳过符号链接与其它特殊文件：工作区内只允许普通文件/目录
        if (dirent.isSymbolicLink()) continue

        const entryPath = prefix ? `${prefix}/${dirent.name}` : dirent.name
        if (dirent.isDirectory()) {
          entries.push({ path: entryPath, name: dirent.name, type: 'directory' })
          await walk(join(directory, dirent.name), entryPath)
        } else if (dirent.isFile()) {
          const stat = await fs.stat(join(directory, dirent.name))
          entries.push({ path: entryPath, name: dirent.name, type: 'file', size: stat.size })
        }
      }
    }

    await walk(root, '')

    return { entries, truncated }
  }

  async stat(userId: string, id: string, path: string) {
    const workspace = await this.requireWorkspace(userId, id)
    const safePath = this.normalizeRelativePath(path)
    const absolutePath = this.absolutePath(workspace, safePath)
    const stat = await this.statRegularFile(absolutePath)

    return {
      path: safePath,
      name: basename(safePath),
      type: 'file' as const,
      size: stat.size,
      mtime: stat.mtime,
    }
  }

  async read(userId: string, id: string, query: ReadFileQueryDto): Promise<TextPage> {
    const workspace = await this.requireWorkspace(userId, id)
    const safePath = this.normalizeRelativePath(query.path)
    const absolutePath = this.absolutePath(workspace, safePath)
    const stat = await this.statRegularFile(absolutePath)

    const offset = query.offset ?? 1
    const limit = query.limit ?? 1000

    try {
      const page = await this.readTextPage(absolutePath, offset, limit)
      return { ...page, path: safePath, size: stat.size }
    } catch (error) {
      if (error instanceof ApiException) throw error
      throw new ApiException(ApiCode.FILE_NOT_TEXT, '文件不是有效的 UTF-8 文本', 400)
    }
  }

  async bytes(userId: string, id: string, path: string): Promise<FileBytes> {
    const workspace = await this.requireWorkspace(userId, id)
    const safePath = this.normalizeRelativePath(path)
    const absolutePath = this.absolutePath(workspace, safePath)
    const stat = await this.statRegularFile(absolutePath)

    if (stat.size > FILE_LIMITS.maxFileBytes) {
      throw new ApiException(ApiCode.FILE_TOO_LARGE, '文件超过预览大小上限', 413)
    }

    return {
      absolutePath,
      size: stat.size,
      contentType: contentTypeForPath(safePath),
    }
  }

  /** 删除工作区内的单个文件或目录（目录递归删除），并重新统计配额 */
  async removeEntry(
    userId: string,
    id: string,
    path: string,
  ): Promise<{ path: string; type: 'file' | 'directory' }> {
    const workspace = await this.requireWorkspace(userId, id)
    const safePath = this.normalizeRelativePath(path)

    return this.withLock(workspace.id, async () => {
      const current = await this.requireWorkspace(userId, id)
      const absolutePath = this.absolutePath(current, safePath)

      let stat
      try {
        stat = await fs.lstat(absolutePath)
      } catch {
        throw new ApiException(ApiCode.FILE_NOT_FOUND, '文件或目录不存在', 404)
      }
      if (!stat.isFile() && !stat.isDirectory()) {
        throw new ApiException(ApiCode.FILE_NOT_FOUND, '目标不是可删除的普通文件或目录', 400)
      }

      await fs.rm(absolutePath, { recursive: true, force: true })

      // 重新扫描统计，避免目录递归删除后计数漂移
      const totals = await this.measureWorkspace(current)
      await this.prisma.fileWorkspace.update({
        where: { id: current.id },
        data: totals,
      })

      return {
        path: safePath,
        type: stat.isDirectory() ? ('directory' as const) : ('file' as const),
      }
    })
  }

  async remove(userId: string, id: string): Promise<void> {
    const workspace = await this.requireWorkspace(userId, id)
    await this.deleteWorkspace(workspace)
  }

  /** 清空过期工作区；供启动定时器与删除时复用 */
  private async purgeExpired(): Promise<void> {
    try {
      const expired = await this.prisma.fileWorkspace.findMany({
        where: { expiresAt: { lt: new Date() } },
        take: 50,
      })
      for (const workspace of expired) {
        await this.deleteWorkspace(workspace)
      }
      if (expired.length > 0) {
        this.logger.log(`已清理 ${expired.length} 个过期文件工作区`)
      }
    } catch (error) {
      // 清理失败不影响主流程，下一轮会重试
      this.logger.warn(`清理过期文件工作区失败：${String(error)}`)
    }
  }

  /** 统计工作区内的普通文件数与总字节数（跳过符号链接与读失败项） */
  private async measureWorkspace(
    workspace: WorkspaceRow,
  ): Promise<{ fileCount: number; totalBytes: number }> {
    let fileCount = 0
    let totalBytes = 0

    const walk = async (directory: string): Promise<void> => {
      let dirents
      try {
        dirents = await fs.readdir(directory, { withFileTypes: true })
      } catch {
        return
      }
      for (const dirent of dirents) {
        if (dirent.isSymbolicLink()) continue
        if (dirent.isDirectory()) {
          await walk(join(directory, dirent.name))
        } else if (dirent.isFile()) {
          try {
            const stat = await fs.stat(join(directory, dirent.name))
            fileCount += 1
            totalBytes += stat.size
          } catch {
            // 统计期间被删除的文件忽略
          }
        }
      }
    }

    await walk(this.workspaceDir(workspace))
    return { fileCount, totalBytes }
  }

  private async deleteWorkspace(workspace: WorkspaceRow): Promise<void> {
    await fs.rm(this.workspaceDir(workspace), { recursive: true, force: true })
    try {
      await this.prisma.fileWorkspace.delete({ where: { id: workspace.id } })
    } catch {
      // 已被并发删除时忽略
    }
  }

  private async requireWorkspace(userId: string, id: string): Promise<WorkspaceRow> {
    const workspace = await this.prisma.fileWorkspace.findFirst({
      where: { id, userId },
    })
    if (!workspace) {
      throw new ApiException(ApiCode.FILE_WORKSPACE_NOT_FOUND, '文件夹不存在或已过期', 404)
    }
    if (workspace.expiresAt.getTime() <= Date.now()) {
      await this.deleteWorkspace(workspace)
      throw new ApiException(ApiCode.FILE_WORKSPACE_NOT_FOUND, '文件夹已过期，请重新上传', 404)
    }
    return workspace
  }

  private workspaceDir(workspace: WorkspaceRow): string {
    return join(this.storageRoot, workspace.userId, workspace.id)
  }

  /**
   * 相对路径校验：拒绝绝对路径、盘符、`..`、NUL 与过长路径。
   * 工作区内部只接受普通路径段（允许中文、空格与点号文件名，但 `.`/`..` 作为段拒绝）。
   */
  private normalizeRelativePath(input: string): string {
    if (typeof input !== 'string') {
      throw new ApiException(ApiCode.FILE_PATH_INVALID, '文件路径不能为空', 400)
    }
    const raw = input.replaceAll('\\', '/')
    if (!raw.trim() || raw.length > 1024 || raw.includes('\0')) {
      throw new ApiException(ApiCode.FILE_PATH_INVALID, '文件路径非法', 400)
    }
    if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) {
      throw new ApiException(ApiCode.FILE_PATH_INVALID, '文件路径必须是工作区内的相对路径', 400)
    }

    const segments = raw.split('/').filter((segment) => segment.length > 0)
    if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
      throw new ApiException(ApiCode.FILE_PATH_INVALID, '文件路径不能包含目录穿越', 400)
    }
    return segments.join('/')
  }

  private absolutePath(workspace: WorkspaceRow, relativePath: string): string {
    const root = this.workspaceDir(workspace)
    const absolutePath = resolve(root, relativePath)
    if (absolutePath !== root && !absolutePath.startsWith(root + sep)) {
      throw new ApiException(ApiCode.FILE_PATH_INVALID, '文件路径超出工作区范围', 400)
    }
    return absolutePath
  }

  private async statRegularFile(absolutePath: string) {
    let stat
    try {
      stat = await fs.lstat(absolutePath)
    } catch {
      throw new ApiException(ApiCode.FILE_NOT_FOUND, '文件不存在', 404)
    }
    if (!stat.isFile()) {
      throw new ApiException(ApiCode.FILE_NOT_FOUND, '目标不是可预览的普通文件', 400)
    }
    return stat
  }

  private async existingFileSize(absolutePath: string): Promise<number | null> {
    try {
      const stat = await fs.lstat(absolutePath)
      return stat.isFile() ? stat.size : null
    } catch {
      return null
    }
  }

  /**
   * 流式读取一页文本：只保留当前页 + 一行前瞻，内存与文件大小无关。
   * - 行号 1 起算；空文件返回空页且 eof=true；
   * - 尾随换行不额外产生空行；
   * - 非法 UTF-8 / NUL 直接判定为非文本。
   */
  private async readTextPage(
    absolutePath: string,
    offset: number,
    limit: number,
  ): Promise<Omit<TextPage, 'path' | 'size'>> {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const stream = createReadStream(absolutePath)
    const collected: string[] = []
    let lineNumber = 0
    let pending = ''
    let stopped = false

    const acceptLine = (line: string): void => {
      lineNumber += 1
      if (lineNumber < offset) return
      if (collected.length < limit) {
        collected.push(line)
        return
      }
      // 窗口已满且后面还有内容：不是 EOF，停止读取
      stopped = true
    }

    try {
      for await (const chunk of stream) {
        pending += decoder.decode(chunk as Buffer, { stream: true })
        if (pending.includes('\0')) {
          throw new ApiException(ApiCode.FILE_NOT_TEXT, '文件包含二进制内容，无法按文本预览', 400)
        }

        let newline = pending.indexOf('\n')
        while (newline !== -1) {
          const line = pending.slice(0, newline)
          pending = pending.slice(newline + 1)
          acceptLine(line)
          if (stopped) break
          newline = pending.indexOf('\n')
        }
        if (stopped) break

        // 单行可能极长（无换行）：限制累积缓冲，避免内存放大
        if (Buffer.byteLength(pending) > FILE_LIMITS.maxPageBytes * 2) {
          throw new ApiException(ApiCode.FILE_TOO_LARGE, '存在超长行，无法按文本预览', 413)
        }
      }

      if (!stopped) {
        pending += decoder.decode()
        if (pending.includes('\0')) {
          throw new ApiException(ApiCode.FILE_NOT_TEXT, '文件包含二进制内容，无法按文本预览', 400)
        }
        if (pending.length > 0) acceptLine(pending)
      }
    } catch (error) {
      if (error instanceof ApiException) throw error
      throw new ApiException(ApiCode.FILE_NOT_TEXT, '文件不是有效的 UTF-8 文本', 400)
    } finally {
      stream.destroy()
    }

    const text = collected.join('\n')
    if (Buffer.byteLength(text) > FILE_LIMITS.maxPageBytes) {
      throw new ApiException(ApiCode.FILE_TOO_LARGE, '当前页内容过大，请减少读取行数', 413)
    }

    return {
      offset,
      lines: collected.length,
      text,
      eof: !stopped,
    }
  }

  private toView(workspace: WorkspaceRow): WorkspaceView {
    return {
      id: workspace.id,
      name: workspace.name,
      fileCount: workspace.fileCount,
      totalBytes: workspace.totalBytes,
      createdAt: workspace.createdAt,
      expiresAt: workspace.expiresAt,
    }
  }

  /** 同一 workspaces 的串行队列：上传计数、替换旧文件时避免竞态 */
  private withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    this.locks.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    void next.then(
      () => {
        if (this.locks.get(key) === next) this.locks.delete(key)
      },
      () => {
        if (this.locks.get(key) === next) this.locks.delete(key)
      },
    )
    return next
  }
}
