# Multi-stage production build for @zolexora/auth-service
# Build context MUST be repo root: docker build -f apps/zolexora-auth-service/Dockerfile .
# Runtime configuration (PORT, HOST, NODE_ENV, secrets) comes from Infisical via compose.yaml — nothing is baked in.

# Node 24 provides native crypto.argon2 (verifies existing argon2id hashes).
FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/zolexora-auth-service ./apps/zolexora-auth-service

# Lockfile-exact install; dependency lifecycle scripts stay disabled.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @zolexora/auth-service...
RUN pnpm --filter @zolexora/auth-service build

# Production-only dependency tree (no devDependencies), plus the compiled output.
RUN pnpm --filter @zolexora/auth-service deploy --prod --ignore-scripts /out \
 && rm -rf /out/src /out/test \
 && cp -r apps/zolexora-auth-service/dist /out/dist \
 && cp -r packages/utils/dist /out/node_modules/@zolexora/utils/dist

FROM node:24-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 authservice
COPY --from=builder --chown=authservice:nodejs /out ./
USER authservice

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/health" || exit 1

CMD ["node", "dist/index.js"]
