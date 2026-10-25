import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ModelsService, type ModelSummary } from './models.service.js'

@ApiTags('chat')
@Controller('chat')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('models')
  @ApiOperation({ summary: '可用模型列表（供前端选择，不含密钥）' })
  @ApiOkResponse({ description: '返回已启用模型的基础信息' })
  list(): Promise<{ items: ModelSummary[] }> {
    return this.modelsService.list()
  }
}
