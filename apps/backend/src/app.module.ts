import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { AuthModule } from './auth/auth.module.js'
import { ChatModule } from './chat/chat.module.js'
import { HealthModule } from './health/health.module.js'
import { PrismaModule } from './prisma/prisma.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
