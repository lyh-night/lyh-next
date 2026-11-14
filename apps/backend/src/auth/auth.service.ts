import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { ApiCode } from '../common/errors/api-code.js'
import { ApiException } from '../common/errors/api.exception.js'
import { PrismaService } from '../prisma/prisma.service.js'
import type { RegisterDto } from './dto/register.dto.js'
import type { VerifyCredentialsDto } from './dto/verify-credentials.dto.js'
import type { AuthUser } from './auth.types.js'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** 注册：邮箱唯一，密码 bcrypt(10) 存储 */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ApiException(ApiCode.AUTH_EMAIL_TAKEN, '该邮箱已被注册', HttpStatus.CONFLICT)
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name || dto.email.split('@')[0],
        password: hashedPassword,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    })

    this.logger.log(`新用户注册: ${user.email}`)

    return { message: '注册成功', user }
  }

  /** 登录：校验邮箱密码，成功返回用户档案（由 AuthController 签发 cookie） */
  async verifyCredentials(dto: VerifyCredentialsDto): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })

    if (!user?.password) {
      throw new ApiException(
        ApiCode.AUTH_INVALID_CREDENTIALS,
        '邮箱或密码错误',
        HttpStatus.UNAUTHORIZED,
      )
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password)
    if (!isPasswordValid) {
      throw new ApiException(
        ApiCode.AUTH_INVALID_CREDENTIALS,
        '邮箱或密码错误',
        HttpStatus.UNAUTHORIZED,
      )
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      hasAccess: user.hasAccess,
      role: user.role,
    }
  }

  /** 读取用户最新档案：/me 与受保护接口用它，保证角色变更即时生效 */
  async profile(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true, hasAccess: true, role: true },
    })

    // 会话失效统一用 10002：前端只认这一个「回登录页」信号
    if (!user) {
      throw new ApiException(ApiCode.UNAUTHORIZED, '用户不存在或已被删除', HttpStatus.UNAUTHORIZED)
    }

    return user
  }
}
