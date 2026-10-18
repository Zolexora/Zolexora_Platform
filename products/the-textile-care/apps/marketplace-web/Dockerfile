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
RUN pnpm --filter @zolexora/ttc-marketplace-web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
COPY --from=builder /app/products/the-textile-care/apps/marketplace-web/public ./apps/marketplace-web/public
COPY --from=builder --chown=nextjs:nodejs \
     /app/products/the-textile-care/apps/marketplace-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/products/the-textile-care/apps/marketplace-web/.next/static ./apps/marketplace-web/.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0
CMD ["node", "apps/marketplace-web/server.js"]
