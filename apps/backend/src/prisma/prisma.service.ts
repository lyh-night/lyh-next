import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * Prisma 客户端（Nest 生命周期托管）。
 * 连接串来自 DATABASE_URL，由 @nestjs/config 在模块初始化前载入。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
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
