FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY packages/api-contracts /packages/api-contracts
COPY products/TheTextileCare/pnpm-workspace.yaml products/TheTextileCare/pnpm-lock.yaml products/TheTextileCare/package.json ./
COPY products/TheTextileCare/apps/marketplace-web/package.json ./apps/marketplace-web/
COPY products/TheTextileCare/packages/ui/package.json           ./packages/ui/
COPY products/TheTextileCare/packages/types/package.json        ./packages/types/
COPY products/TheTextileCare/packages/config/package.json       ./packages/config/
COPY products/TheTextileCare/packages/auth/package.json         ./packages/auth/
COPY products/TheTextileCare/packages/tenant/package.json       ./packages/tenant/
COPY products/TheTextileCare/packages/api-client/package.json   ./packages/api-client/
RUN pnpm install --frozen-lockfile

# ── builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY products/TheTextileCare .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter @ttc/marketplace-web build

# ── runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/marketplace-web/public          ./apps/marketplace-web/public
COPY --from=builder --chown=nextjs:nodejs \
     /app/apps/marketplace-web/.next/standalone               ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/apps/marketplace-web/.next/static                   ./apps/marketplace-web/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0

CMD ["node", "apps/marketplace-web/server.js"]
