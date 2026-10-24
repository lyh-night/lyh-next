import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6, { message: '密码必须至少包含 6 个字符' })
  @MaxLength(72, { message: '密码不能超过 72 个字符' })
  password!: string

  @ApiPropertyOptional({ example: 'Lyh' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string
}
