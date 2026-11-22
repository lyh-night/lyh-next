import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { createReadStream } from 'node:fs'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator.js'
import { SkipResponseEnvelope } from '../common/decorators/skip-response-envelope.decorator.js'
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js'
import { FilePathQueryDto } from './dto/file-path-query.dto.js'
import { ReadFileQueryDto } from './dto/read-file-query.dto.js'
import { UploadFileDto } from './dto/upload-file.dto.js'
import { FILE_LIMITS, isInlineContentType } from './files.constants.js'
import { FilesService, type UploadedFile as UploadedFileLike } from './files.service.js'

/**
 * 上传文件工作区的只读访问接口。
 *
 * - 创建/删除/上传是仅有的写操作；树、文本分页、字节读取都是只读；
 * - 所有路由按 `@CurrentUser('id')` 校验工作区归属；
 * - `/bytes` 自行写响应（跳过信封），供前端 Blob URL 使用。
 */
@ApiTags('files')
@Controller('files/workspaces')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '创建文件工作区（上传文件夹前调用）' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkspaceDto) {
    return this.filesService.create(userId, dto.name)
  }

  @Get(':id')
  @ApiOperation({ summary: '文件工作区元信息' })
  detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.filesService.detail(userId, id)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文件工作区（连同磁盘文件）' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.filesService.remove(userId, id)
  }

  @Post(':id/upload')
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // 内存存储：校验路径后由 service 落盘，避免 multipart 阶段提前写未知位置
      limits: { fileSize: FILE_LIMITS.maxFileBytes, files: 1 },
    }),
  )
  @ApiOperation({ summary: '上传单个文件到工作区（multipart，字段 file + path）' })
  @ApiOkResponse({ description: '返回已写入文件的相对路径与大小' })
  upload(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ) {
    return this.filesService.upload(userId, id, dto.path, file)
  }

  @Delete(':id/entry')
  @ApiOperation({ summary: '删除工作区内的文件或目录（目录递归删除）' })
  @ApiOkResponse({ description: '返回被删除的相对路径与类型' })
  removeEntry(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() dto: FilePathQueryDto,
  ) {
    return this.filesService.removeEntry(userId, id, dto.path)
  }

  @Get(':id/tree')
  @ApiOperation({ summary: '目录树（扁平列表，目录优先，最多 2000 项）' })
  tree(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.filesService.tree(userId, id)
  }

  @Get(':id/stat')
  @ApiOperation({ summary: '单个文件的元信息（大小、更新时间）' })
  stat(@CurrentUser('id') userId: string, @Param('id') id: string, @Query() dto: FilePathQueryDto) {
    return this.filesService.stat(userId, id, dto.path)
  }

  @Get(':id/read')
  @ApiOperation({ summary: '按行分页读取 UTF-8 文本（offset 1 起算）' })
  read(@CurrentUser('id') userId: string, @Param('id') id: string, @Query() dto: ReadFileQueryDto) {
    return this.filesService.read(userId, id, dto)
  }

  @Get(':id/bytes')
  @SkipResponseEnvelope()
  @ApiOperation({ summary: '读取文件原始字节（图片 / PDF 预览用）' })
  async bytes(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() dto: FilePathQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.filesService.bytes(userId, id, dto.path)

    response.setHeader('Content-Type', file.contentType)
    response.setHeader('Content-Length', file.size)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    // 原始字节不进入应用文档树；浏览器内置查看器仍需在同源 Blob 中运行
    response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
    response.setHeader(
      'Content-Disposition',
      `${isInlineContentType(file.contentType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.absolutePath.split('/').pop() ?? 'file')}`,
    )

    return new StreamableFile(createReadStream(file.absolutePath), {
      type: file.contentType,
      length: file.size,
    })
  }
}
