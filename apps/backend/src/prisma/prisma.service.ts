import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * Prisma 客户端（Nest 生命周期托管）。
 * 连接串来自 DATABASE_URL，由 ConfigModule 启动期校验保证存在。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('数据库连接已建立')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
