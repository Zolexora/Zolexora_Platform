FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @zolexora/platform-admin-frontend --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
ARG NEXT_PUBLIC_API_URL=http://localhost:4041
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @zolexora/platform-admin-frontend build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/platform-admin/frontend/public ./apps/platform-admin/frontend/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/platform-admin/frontend/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/platform-admin/frontend/.next/static ./apps/platform-admin/frontend/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/platform-admin/frontend/server.js"]
