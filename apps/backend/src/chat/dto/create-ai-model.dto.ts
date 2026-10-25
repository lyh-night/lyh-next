import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateAiModelDto {
  @ApiPropertyOptional({ description: '提供商展示名', example: 'DeepSeek' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string

  @ApiProperty({ description: '展示名称', example: 'DeepSeek 对话' })
  @IsString()
  @IsNotEmpty({ message: 'displayName 不能为空' })
  @MaxLength(60)
  displayName!: string

  @ApiProperty({ description: '传给上游的 model 字段', example: 'deepseek-chat' })
  @IsString()
  @IsNotEmpty({ message: 'model 不能为空' })
  @MaxLength(120)
  model!: string

  @ApiProperty({ description: 'OpenAI 兼容地址', example: 'https://api.deepseek.com/v1' })
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'], require_tld: false },
    { message: 'baseUrl 必须是合法的 http(s) 地址' },
  )
  baseUrl!: string

  @ApiProperty({ description: '第三方平台密钥，只写不读' })
  @IsString()
  @IsNotEmpty({ message: 'apiKey 不能为空' })
  apiKey!: string

  @ApiPropertyOptional({ description: '是否为默认模型', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ description: '排序值，越小越靠前', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @ApiPropertyOptional({ description: '默认采样温度', minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @ApiPropertyOptional({ description: '默认最大生成 token 数', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number
}
