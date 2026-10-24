FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat

# 依赖层：只复制 workspace 清单，最大化层缓存
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/utils/package.json ./packages/utils/
COPY packages/components/package.json ./packages/components/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/packages/components/node_modules ./packages/components/node_modules
COPY . .
RUN pnpm exec turbo run build --filter=@lyh-next/frontend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 保留了 monorepo 目录层级（受 outputFileTracingRoot 控制）
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "apps/frontend/server.js"]
