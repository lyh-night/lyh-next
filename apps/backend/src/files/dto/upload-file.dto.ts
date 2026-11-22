import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UploadFileDto {
  @ApiProperty({ description: '相对于工作区根目录的文件路径（用 / 分隔）' })
  @IsString()
  @IsNotEmpty({ message: 'path 不能为空' })
  @MaxLength(1024)
  path!: string
}
