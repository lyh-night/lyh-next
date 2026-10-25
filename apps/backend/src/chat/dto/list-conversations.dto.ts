import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListConversationsDto {
  @ApiPropertyOptional({ description: '页码，从 1 开始', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: '每页条数', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
