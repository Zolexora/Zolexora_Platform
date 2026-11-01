# Multi-stage production build for @zolexora/auth-service
# Build context MUST be repo root: docker build -f apps/zolexora-auth-service/Dockerfile .

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

FROM base AS builder
WORKDIR /app

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy packages and auth-service workspace
COPY packages ./packages
COPY apps/zolexora-auth-service ./apps/zolexora-auth-service

# Install dependencies and build shared packages & auth-service
RUN pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile
RUN pnpm --filter @zolexora/utils build
RUN pnpm --filter @zolexora/auth-service build

FROM node:22-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 authservice

# Copy dependencies and build outputs
COPY --from=builder --chown=authservice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=authservice:nodejs /app/packages ./packages
COPY --from=builder --chown=authservice:nodejs /app/apps/zolexora-auth-service/dist ./apps/zolexora-auth-service/dist
COPY --from=builder --chown=authservice:nodejs /app/apps/zolexora-auth-service/package.json ./apps/zolexora-auth-service/package.json
COPY --from=builder --chown=authservice:nodejs /app/apps/zolexora-auth-service/.infisical.json ./apps/zolexora-auth-service/.infisical.json

WORKDIR /app/apps/zolexora-auth-service

USER authservice

ENV PORT=3081 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 3081

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3081/health || exit 1

CMD ["node", "dist/index.js"]
