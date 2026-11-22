import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateWorkspaceDto {
  @ApiPropertyOptional({ description: '工作区名称（通常取上传文件夹的根目录名）', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string
}
