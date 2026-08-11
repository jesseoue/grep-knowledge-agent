# gVisor sandbox service — read-only grep/find/cat over the snapshot volume
FROM node:24-slim

WORKDIR /app

# gVisor is the isolation boundary. When run on Railway as a sidecar service,
# this image executes only allowlisted read-only commands inside /snapshot.
COPY sandbox-service/ sandbox-service/
COPY packages/sdk/ packages/sdk/
COPY package.json bun.lock* bunfig.toml ./

# Minimal runtime deps for grep/find/cat on node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    grep findutils coreutils \
    && rm -rf /var/lib/apt/lists/*

# If a bun.lock exists, use it for install; otherwise npm fallback.
RUN (test -f bun.lock && bun install --frozen-lockfile --production) || npm install --production

EXPOSE 3200

CMD ["node", "sandbox-service/index.ts"]
