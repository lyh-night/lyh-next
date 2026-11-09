import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { AuthModule } from './auth/auth.module.js'
import { ChatModule } from './chat/chat.module.js'
import { CommonModule } from './common/common.module.js'
import { validateEnv } from './common/config/env.validation.js'
import { HealthModule } from './health/health.module.js'
import { PrismaModule } from './prisma/prisma.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      // 启动期校验：缺少必填变量或格式非法时直接失败
      validate: validateEnv,
    }),
    // 全局横切基础设施（filter / interceptor）必须最先注册
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
