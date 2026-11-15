import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { Redis } from 'ioredis'
import { APP_GUARD } from '@nestjs/core'
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
    // 全局限流：默认 300 次/分钟，登录与对话接口单独收紧（见各控制器 @Throttle）
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            limit: config.get<number>('THROTTLE_LIMIT') ?? 300,
            ttl: (config.get<number>('THROTTLE_TTL_SECONDS') ?? 60) * 1000,
          },
        ],
        // 配置 REDIS_URL 时多实例共享限流计数；单实例留空走内存存储
        ...(config.get<string>('REDIS_URL')
          ? { storage: new ThrottlerStorageRedisService(config.getOrThrow<string>('REDIS_URL')) }
          : {}),
      }),
    }),
    // 全局横切基础设施（filter / interceptor）必须最先注册
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
