import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CookieOptions, Response } from 'express'
import { AuthService, type AuthUser } from './auth.service.js'
import { RegisterDto } from './dto/register.dto.js'
import { VerifyCredentialsDto } from './dto/verify-credentials.dto.js'
import type { AuthRequest } from './jwt-auth.guard.js'
import { Public } from './public.decorator.js'
import { TokenService } from './token.service.js'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string
  private readonly cookieOptions: CookieOptions

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    config: ConfigService,
  ) {
    this.cookieName = config.get<string>('AUTH_COOKIE_NAME') ?? 'auth_token'
    this.cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.get<string>('NODE_ENV') === 'production',
      path: '/',
      maxAge: this.tokenService.ttlSeconds * 1000,
    }
  }

  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '注册账号' })
  @ApiCreatedResponse({ description: '注册成功，返回新建用户的基础信息' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '登录（成功后写入 httpOnly cookie）' })
  @ApiOkResponse({ description: '返回用户档案，会话保存在 httpOnly cookie 中' })
  async login(
    @Body() dto: VerifyCredentialsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser }> {
    const user = await this.authService.verifyCredentials(dto)
    const token = await this.tokenService.sign(user)

    res.cookie(this.cookieName, token, this.cookieOptions)

    return { user }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '退出登录（清除 cookie）' })
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(this.cookieName, { path: '/' })
    return { success: true }
  }

  @Get('me')
  @ApiOperation({ summary: '当前登录用户（读取最新档案）' })
  @ApiOkResponse({ description: '未登录返回 401' })
  async me(@Req() request: AuthRequest): Promise<{ user: AuthUser }> {
    // 守卫已保证 request.user 存在
    const user = await this.authService.profile(request.user?.id ?? '')
    return { user }
  }
}
