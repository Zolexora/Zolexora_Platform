# Build context: repo root (docker build -f products/zolexora-ims/apps/ims-user/frontend/Dockerfile .)
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY products/zolexora-ims/apps/ims-user/frontend ./products/zolexora-ims/apps/ims-user/frontend

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm config set store-dir /root/.local/share/pnpm/store && \
    pnpm config set ignore-scripts true && \
    pnpm install --frozen-lockfile --filter "@zolexora/ims-user-frontend..."

# Builds the app and the workspace packages it uses (auth-client, utils)
RUN pnpm --filter "@zolexora/ims-user-frontend..." build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/products/zolexora-ims/apps/ims-user/frontend/dist /usr/share/nginx/html
COPY products/zolexora-ims/apps/ims-user/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY products/zolexora-ims/docker-entrypoint-env.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1
