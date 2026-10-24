import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString } from 'class-validator'

export class VerifyCredentialsDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string

  @ApiProperty({ example: '123456' })
  @IsString()
  password!: string
}
