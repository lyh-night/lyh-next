#!/usr/bin/env node
/**
 * postinstall 钩子：生成 backend 的 Prisma Client。
 *
 * 跳过条件：
 * - schema 不存在（Docker 的 frontend deps 阶段未复制 apps/backend）
 * - prisma CLI 不可用（`pnpm install --prod` 跳过了 devDependencies）
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const schemaPath = 'apps/backend/prisma/schema.prisma'
const prismaBin = 'apps/backend/node_modules/.bin/prisma'

if (!existsSync(schemaPath) || !existsSync(prismaBin)) {
  console.log('[postinstall] 跳过 Prisma Client 生成（未找到 schema 或 prisma CLI）')
  process.exit(0)
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

execFileSync(pnpm, ['--filter', '@lyh-next/backend', 'run', 'generate'], { stdio: 'inherit' })
