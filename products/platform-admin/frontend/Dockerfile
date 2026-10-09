FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @zolexora/platform-admin-frontend build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/products/platform-admin/frontend/package.json .
COPY --from=builder /app/products/platform-admin/frontend/.next ./.next
COPY --from=builder /app/products/platform-admin/frontend/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
