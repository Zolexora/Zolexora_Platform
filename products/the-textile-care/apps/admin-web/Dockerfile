FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY products/the-textile-care ./products/the-textile-care
RUN pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile

FROM deps AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4010
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter @zolexora/ttc-admin-web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
COPY --from=builder /app/products/the-textile-care/apps/admin-web/public ./apps/admin-web/public
COPY --from=builder --chown=nextjs:nodejs \
     /app/products/the-textile-care/apps/admin-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/products/the-textile-care/apps/admin-web/.next/static ./apps/admin-web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/admin-web/server.js"]
