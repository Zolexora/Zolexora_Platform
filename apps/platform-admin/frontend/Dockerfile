FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile
RUN pnpm --filter @zolexora/platform-admin-frontend build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/platform-admin/frontend/package.json ./apps/platform-admin/frontend/package.json
COPY --from=builder /app/apps/platform-admin/frontend/.next ./apps/platform-admin/frontend/.next
COPY --from=builder /app/apps/platform-admin/frontend/public ./apps/platform-admin/frontend/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/platform-admin/frontend/node_modules ./apps/platform-admin/frontend/node_modules
EXPOSE 3000
WORKDIR /app/apps/platform-admin/frontend
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
