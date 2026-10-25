import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateConversationDto {
  @ApiPropertyOptional({ description: '会话标题，默认「新对话」', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @ApiPropertyOptional({ description: '默认模型配置 id；省略则用数据库里的默认模型' })
  @IsOptional()
  @IsString()
  modelId?: string

  @ApiPropertyOptional({ description: '系统提示词；省略则用后端默认值', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string
}
