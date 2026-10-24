import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service.js'
import type { RegisterDto } from './dto/register.dto.js'
import type { VerifyCredentialsDto } from './dto/verify-credentials.dto.js'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
  hasAccess: boolean
  role: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** 注册：邮箱唯一，密码 bcrypt(10) 存储 */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException('该邮箱已被注册')
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

  /**
   * 凭据校验：供前端 NextAuth 的 authorize() 服务端调用。
   * 成功返回用户档案，失败统一 401（不暴露邮箱是否存在）。
   */
  async verifyCredentials(dto: VerifyCredentialsDto): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })

    if (!user?.password) {
      throw new UnauthorizedException('邮箱或密码错误')
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误')
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
}
