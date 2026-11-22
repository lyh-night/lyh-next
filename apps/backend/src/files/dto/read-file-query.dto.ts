import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { FILE_LIMITS } from '../files.constants.js'

export class ReadFileQueryDto {
  @ApiProperty({ description: '相对于工作区根目录的文件路径（用 / 分隔）' })
  @IsString()
  @IsNotEmpty({ message: 'path 不能为空' })
  @MaxLength(1024)
  path!: string

  @ApiPropertyOptional({ description: '起始行号（1 起算）', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  offset?: number

  @ApiPropertyOptional({
    description: '本页最多行数',
    default: 1000,
    minimum: 1,
    maximum: FILE_LIMITS.maxLinesPerPage,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FILE_LIMITS.maxLinesPerPage)
  limit?: number
}
