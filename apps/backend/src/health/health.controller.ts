import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../auth/public.decorator.js'
import { SkipResponseEnvelope } from '../common/decorators/skip-response-envelope.decorator.js'
import { PrismaService } from '../prisma/prisma.service.js'

/** 就绪探针输出：db=false 时编排层应把实例摘出负载 */
export interface ProbeStatus {
  status: 'ok' | 'degraded'
  db: boolean
  uptime: number
  timestamp: string
  version: string
}

/** DB ping 超时：超过即视为未就绪 */
const DB_PING_TIMEOUT_MS = 2000

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 存活探针：进程活着即 ok，不探测任何依赖。
   * 容器 HEALTHCHECK 用它，避免数据库抖动误杀实例。
   */
  @Get('live')
  @Public()
  @SkipResponseEnvelope()
  @ApiOperation({ summary: '存活探针（不探测依赖）' })
  @ApiOkResponse({ description: 'HTTP 200 即存活，body 为纯 JSON（不包信封）' })
  live(@Res({ passthrough: true }) response: Response): void {
    response.status(HttpStatus.OK).json(this.buildStatus('ok'))
  }

  /**
   * 就绪探针：ping 数据库（SELECT 1，2s 超时）。
   * 不通过 → HTTP 503 + status=degraded，编排层据此摘除流量。
   */
  @Get()
  @Public()
  @SkipResponseEnvelope()
  @ApiOperation({ summary: '就绪探针（探测数据库，失败返回 503）' })
  @ApiOkResponse({ description: '数据库可达时 HTTP 200；不可达时 HTTP 503 + status=degraded' })
  async ready(@Res({ passthrough: true }) response: Response): Promise<void> {
    const dbUp = await this.pingDb()

    if (!dbUp) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json(this.buildStatus('degraded'))
      return
    }

    response.status(HttpStatus.OK).json(this.buildStatus('ok'))
  }

  private buildStatus(status: ProbeStatus['status']): ProbeStatus {
    return {
      status,
      db: status === 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
    }
  }

  private async pingDb(): Promise<boolean> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB ping 超时')), DB_PING_TIMEOUT_MS),
        ),
      ])
      return true
    } catch {
      return false
    }
  }
}
