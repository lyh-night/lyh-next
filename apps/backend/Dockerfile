# 构建上下文为仓库根目录（pnpm workspace），
# docker compose 中通过 context: . + dockerfile: apps/backend/Dockerfile 引用
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 仅安装 backend 依赖（workspace 清单需齐全，否则 frozen-lockfile 校验失败）
FROM base AS deps
# prisma generate 只需要一个占位连接串，不会真正连库
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lyh-next-db"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/components/package.json ./packages/components/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile --filter @lyh-next/backend

FROM deps AS builder
COPY apps/backend ./apps/backend
RUN pnpm --filter @lyh-next/backend build

# 运行期依赖（不含 nest cli / typescript / prisma cli 等 devDependencies）
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/components/package.json ./packages/components/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile --prod --filter @lyh-next/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

USER nodejs
WORKDIR /app/apps/backend
EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/main.js"]
