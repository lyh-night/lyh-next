import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // Prisma 支持「多文件 schema」：指向目录，目录内所有 *.prisma 合并为一个 schema
  // （schema.prisma 放 datasource/generator，chat.prisma 放对话相关模型）
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
