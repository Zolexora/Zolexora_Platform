# ------------------------------------------------------------------------------
# Stage 1: Build React/Vite SPA
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and pin pnpm to monorepo packageManager version
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy package manifests
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy application source
COPY . .

# Build production bundle
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
