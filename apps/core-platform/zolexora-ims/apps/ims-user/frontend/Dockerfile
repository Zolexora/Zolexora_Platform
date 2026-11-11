# Built only by GitHub CI (zolexora-ims-docker.yml) with the repo root as context.
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/core-platform/zolexora-ims/apps/ims-user/frontend ./apps/core-platform/zolexora-ims/apps/ims-user/frontend

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm config set store-dir /root/.local/share/pnpm/store && \
    pnpm config set ignore-scripts true && \
    pnpm install --frozen-lockfile --filter "@zolexora/ims-user-frontend..."

# Builds the app and the workspace packages it uses (auth-client, utils)
RUN pnpm --filter "@zolexora/ims-user-frontend..." build

# Runs anywhere: PORT (default 3000) and IMS_API_URL (the backend's base URL) are read at start.
FROM nginx:alpine
ENV PORT=3000
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/core-platform/zolexora-ims/apps/ims-user/frontend/dist /usr/share/nginx/html
COPY apps/core-platform/zolexora-ims/apps/ims-user/frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/core-platform/zolexora-ims/docker-entrypoint-env.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT}/healthz" || exit 1
