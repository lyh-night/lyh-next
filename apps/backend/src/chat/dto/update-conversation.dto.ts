import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '新标题', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @ApiPropertyOptional({ description: '切换模型配置 id' })
  @IsOptional()
  @IsString()
  modelId?: string

  @ApiPropertyOptional({ description: '系统提示词（传空字符串表示使用默认值）', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string
}
