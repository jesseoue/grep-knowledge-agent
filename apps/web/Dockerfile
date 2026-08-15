# Grep Knowledge Agent — deterministic build, minimal production runtime
FROM oven/bun:1.3.14-slim AS build
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json bun.lock* bunfig.toml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/agent/package.json packages/agent/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY sandbox-service/package.json sandbox-service/package.json

# Install all workspace deps
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build the Nuxt app (outputs to apps/web/.output)
RUN bun run --filter ./apps/web build

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

# Nitro's node-server output is self-contained, including its traced runtime
# dependencies. Copying only this output avoids the 800+ MB workspace tree.
COPY --from=build --chown=node:node /app/apps/web/.output ./apps/web/.output
COPY --from=build --chown=node:node /app/apps/web/server/db/migrations ./apps/web/server/db/migrations
# Keep the private, operator-only recovery utility in the runtime image so it
# can be invoked through authenticated Railway SSH without exposing an endpoint.
COPY --from=build --chown=node:node /app/apps/web/scripts/recover-owner.mjs ./apps/web/.output/server/recover-owner.mjs

# Run as non-root user for security (node image provides the "node" user)
USER node

# Railway injects $PORT (default 8080) at runtime. EXPOSE is informational only.
EXPOSE 8080

STOPSIGNAL SIGTERM

# Lightweight healthcheck using Node (no curl needed in slim image).
# Uses process.env.PORT (Railway-injected) or 3000 as a local fallback.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const r=require('http').request({host:'127.0.0.1',port:process.env.PORT||3000,path:'/api/health'},res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.end();"]

CMD ["node", "apps/web/.output/server/index.mjs"]
