# Grep Knowledge Agent — web service
# Multi-stage build: install deps → build Nuxt → slim runtime

# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:24-slim AS base
RUN npm install -g bun@1.3.14
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock* bunfig.toml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/agent/package.json packages/agent/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY sandbox-service/package.json sandbox-service/package.json

# Install all workspace deps
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY . .

# Build the Nuxt app (outputs to apps/web/.output)
RUN cd apps/web && bun run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0
# IMPORTANT: do NOT set PORT or NITRO_PORT here. Railway injects $PORT
# (default 8080) at runtime and routes traffic + healthchecks to it. Nitro
# resolves the port via `NITRO_PORT || PORT`, so setting either hardcodes the
# container to 3000 and breaks the deploy (healthcheck hits the wrong port).
# Leaving them unset lets Nitro pick up Railway's injected $PORT automatically.

# Copy only the production build output + migrations + node_modules
COPY --from=base /app/apps/web/.output ./apps/web/.output
COPY --from=base /app/apps/web/server/db/migrations ./apps/web/server/db/migrations
COPY --from=base /app/node_modules ./node_modules

# Run as non-root user for security (node image provides the "node" user)
USER node

EXPOSE 3000

# Lightweight healthcheck using Node (no curl needed in slim image).
# Uses process.env.PORT (Railway-injected) or 3000 as a local fallback.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const r=require('http').request({host:'127.0.0.1',port:process.env.PORT||3000,path:'/api/health'},res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.end();"]

CMD ["node", "apps/web/.output/server/index.mjs"]
