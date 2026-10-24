import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuthService, type AuthUser } from './auth.service.js'
import { RegisterDto } from './dto/register.dto.js'
import { VerifyCredentialsDto } from './dto/verify-credentials.dto.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '注册账号' })
  @ApiCreatedResponse({ description: '注册成功，返回新建用户的基础信息' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('verify-credentials')
  @HttpCode(200)
  @ApiOperation({ summary: '校验邮箱密码（供 NextAuth authorize 调用）' })
  @ApiOkResponse({ description: '校验通过返回用户档案，失败返回 401' })
  verifyCredentials(@Body() dto: VerifyCredentialsDto): Promise<AuthUser> {
    return this.authService.verifyCredentials(dto)
  }
}
