import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

export interface HealthStatus {
  status: 'ok'
  uptime: number
  timestamp: string
  version: string
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: '健康检查' })
  @ApiOkResponse({ description: '服务存活时返回 ok' })
  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
    }
  }
}
