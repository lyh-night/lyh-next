import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AppService } from './app.service.js'
import type { ServiceInfo } from './app.service.js'

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '服务信息' })
  @ApiOkResponse({ description: '返回服务名称、版本与运行环境' })
  getInfo(): ServiceInfo {
    return this.appService.getInfo()
  }
}
