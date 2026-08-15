# Policy-restricted sandbox service — read-only grep/find/cat at chat time.
FROM oven/bun:1.3.14-slim AS build
WORKDIR /src
COPY sandbox-service/ ./sandbox-service/
RUN bun build sandbox-service/index.ts \
    --target=node \
    --format=esm \
    --minify \
    --outfile=/out/server.mjs

FROM node:24-slim

WORKDIR /app

# Minimal runtime deps for grep/find/cat + git (repo sync) on node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    grep findutils coreutils git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Self-contained bundle: the sandbox has zero runtime npm dependencies.
COPY --from=build /out/server.mjs ./server.mjs

ENV NODE_ENV=production
ENV PORT=3200

# The snapshot volume is mounted at /snapshot at runtime. Railway mounts it
# as root-owned, so the node user cannot create subdirectories needed for sync.
# Keep this service private, share SANDBOX_SECRET with the web service, and rely
# on the independently validated read/sync policies in the bundled server.
USER root

# Ensure the snapshot mount point exists and is writable.
RUN mkdir -p /snapshot/gh && chmod 777 /snapshot

EXPOSE 3200

STOPSIGNAL SIGTERM

# Lightweight healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const r=require('http').request({host:'127.0.0.1',port:process.env.PORT||3200,path:'/health'},res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.end();"]

CMD ["node", "server.mjs"]
