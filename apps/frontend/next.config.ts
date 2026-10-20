import path from 'node:path'
import type { NextConfig } from 'next'

// 命令均由 pnpm/turbo 在 apps/frontend 目录下执行，因此 cwd 向上两级即仓库根
const workspaceRoot = path.join(process.cwd(), '../..')

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  output: 'standalone',
  // 源码包需要被 Next 编译
  transpilePackages: ['@lyh-next/components'],
  // monorepo 下 standalone 必须显式指定追踪根，否则 server.js 目录层级错误
  outputFileTracingRoot: workspaceRoot,
}

export default nextConfig
