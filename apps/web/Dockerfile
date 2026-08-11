# Grep Knowledge Agent — web service
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

# Production image — minimal runtime
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=base /app/apps/web/.output ./apps/web/.output
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "apps/web/.output/server/index.mjs"]
