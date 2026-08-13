# gVisor sandbox service — read-only grep/find/cat over the snapshot volume
FROM node:24-slim

WORKDIR /app

# Minimal runtime deps for grep/find/cat + git (repo sync) on node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    grep findutils coreutils git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Self-contained: the sandbox has zero runtime npm dependencies.
COPY --chown=node:node sandbox-service/ sandbox-service/

ENV NODE_ENV=production
ENV PORT=3200

# The snapshot volume is mounted at /snapshot at runtime. Railway mounts it
# as root-owned, so the node user can't create subdirectories (needed for
# git clone during sync). Run as root — the sandbox is already isolated
# (gVisor container, read-only command allowlist, no public exposure).
USER root

# Ensure the snapshot mount point exists and is writable.
RUN mkdir -p /snapshot/gh && chmod 777 /snapshot

EXPOSE 3200

# Lightweight healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const r=require('http').request({host:'127.0.0.1',port:process.env.PORT||3200,path:'/health'},res=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.end();"]

CMD ["node", "sandbox-service/index.ts"]
