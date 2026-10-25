import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreateAiModelDto } from './dto/create-ai-model.dto.js'
import { UpdateAiModelDto } from './dto/update-ai-model.dto.js'
import { ModelsService, type ModelConfig, type ModelSummary } from './models.service.js'

@ApiTags('chat')
@Controller('chat')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get('models')
  @ApiOperation({ summary: '可用模型列表（供聊天选择，不含 baseUrl 与密钥）' })
  @ApiOkResponse({ description: '返回已启用模型的基础信息' })
  list(): Promise<{ items: ModelSummary[] }> {
    return this.modelsService.list()
  }

  @Get('models/configs')
  @ApiOperation({ summary: '模型配置列表（设置页用，含停用项与密钥掩码）' })
  @ApiOkResponse({ description: '返回全部模型配置，apiKey 只返回掩码' })
  listConfigs(): Promise<{ items: ModelConfig[] }> {
    return this.modelsService.listConfigs()
  }

  @Post('models')
  @ApiOperation({ summary: '新增模型配置' })
  @ApiCreatedResponse({ description: '创建成功，返回掩码后的配置' })
  create(@Body() dto: CreateAiModelDto): Promise<ModelConfig> {
    return this.modelsService.create(dto)
  }

  @Patch('models/:id')
  @ApiOperation({ summary: '更新模型配置（apiKey 留空表示不修改）' })
  update(@Param('id') id: string, @Body() dto: UpdateAiModelDto): Promise<ModelConfig> {
    return this.modelsService.update(id, dto)
  }

  @Delete('models/:id')
  @ApiOperation({ summary: '删除模型配置' })
  remove(@Param('id') id: string): Promise<{ success: true }> {
    return this.modelsService.remove(id)
  }
}
