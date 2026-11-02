import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { TokenService } from './token.service.js'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    // 全局登录守卫：默认所有接口都要登录，@Public() 放行
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
