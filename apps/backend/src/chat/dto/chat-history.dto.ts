import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export class ChatHistoryDto {
  @ApiProperty({ description: '会话 id' })
  @IsString()
  @IsNotEmpty({ message: 'conversationId 不能为空' })
  conversationId!: string

  @ApiPropertyOptional({ description: '每页条数', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @ApiPropertyOptional({ description: '分页锚点：返回该消息之前（更旧）的一页；省略则取最近一页' })
  @IsOptional()
  @IsString()
  messageId?: string
}
