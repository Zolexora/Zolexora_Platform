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

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app/apps/platform-admin/frontend/package.json ./apps/platform-admin/frontend/package.json
COPY --from=installer /app/apps/platform-admin/frontend/.next ./apps/platform-admin/frontend/.next
COPY --from=installer /app/apps/platform-admin/frontend/public ./apps/platform-admin/frontend/public
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/platform-admin/frontend/node_modules ./apps/platform-admin/frontend/node_modules
EXPOSE 3000
WORKDIR /app/apps/platform-admin/frontend
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
