# gVisor sandbox service — read-only grep/find/cat over the snapshot volume
FROM node:24-slim

WORKDIR /app

# Minimal runtime deps for grep/find/cat on node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    grep findutils coreutils \
    && rm -rf /var/lib/apt/lists/*

# Self-contained: the sandbox has zero runtime npm dependencies.
COPY sandbox-service/ sandbox-service/

EXPOSE 3200

CMD ["node", "sandbox-service/index.ts"]
