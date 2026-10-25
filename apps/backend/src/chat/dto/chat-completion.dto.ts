import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class ChatCompletionDto {
  @ApiPropertyOptional({ description: '会话 id；省略则自动创建新会话' })
  @IsOptional()
  @IsString()
  conversationId?: string

  @ApiPropertyOptional({ description: '模型配置 id；省略则用会话模型或默认模型' })
  @IsOptional()
  @IsString()
  modelId?: string

  @ApiProperty({ description: '本轮用户输入（历史由后端维护，无需传 messages）', maxLength: 8000 })
  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  @MaxLength(8000, { message: 'content 不能超过 8000 字' })
  content!: string

  @ApiPropertyOptional({
    description: '采样温度，0–2；省略则用模型配置或上游默认',
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @ApiPropertyOptional({ description: '最大生成 token 数；省略则用模型配置', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number
}
