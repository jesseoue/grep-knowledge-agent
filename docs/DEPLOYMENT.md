# Deployment

## One-click on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/grep-knowledge-agent?utm_medium=integration&utm_source=button&utm_campaign=grep-knowledge-agent)

The template provisions:

- **Web service** (Nuxt + Nitro) with `${{secret()}}`-generated `BETTER_AUTH_SECRET`
- **Sandbox service** with a snapshot volume at `/snapshot`
- **PostgreSQL** (Railway plugin) → `DATABASE_URL`
- **Redis** (Railway plugin) → `REDIS_URL`

### After deploy

1. Set an AI provider key — at least one of:
   - `OPENAI_API_KEY` → <https://platform.openai.com/api-keys>
   - `ANTHROPIC_API_KEY` → <https://console.anthropic.com/settings/keys>
   - `GOOGLE_GENERATIVE_AI_API_KEY` → <https://aistudio.google.com/apikey>

   See [ENVIRONMENT.md](ENVIRONMENT.md) for detailed instructions.

2. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (see [ENVIRONMENT.md](ENVIRONMENT.md) → "Setting up GitHub OAuth").

3. Open your app → **Settings** → add a GitHub source (e.g. `vercel-labs/knowledge-agent-template`) → **Sync**.

4. Ask it anything. It answers with `grep`, not vectors.

## Manual deploy

```bash
# Local build
bun install
bun run db:migrate    # generates + applies migrations (needs DATABASE_URL)
bun run dev

# Production
bun run build
bun run start
```

## Docker

```bash
# Build and run the web service
docker build -f apps/web/Dockerfile -t grep-agent-web .
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  -e OPENAI_API_KEY=... \
  grep-agent-web

# Build and run the sandbox service
docker build -f sandbox-service/Dockerfile -t grep-agent-sandbox .
docker run -p 3200:3200 -v /tmp/snapshot:/snapshot grep-agent-sandbox
```

## Railway config

- `railway.json` / `railway.toml` — root config-as-code: Nixpacks build, healthcheck at `/api/health`, restart-on-failure.
- `apps/web/Dockerfile` — multi-stage: bun install → Nuxt build → minimal node runtime.
- `sandbox-service/Dockerfile` — node slim + grep/find/coreutils.

## Health checks

- Web: `GET /api/health` → `{"status":"ok"}` (used by Railway readiness check)
- Sandbox: `GET /health` or `GET /api/health` → `{"status":"ok"}`

## Volumes

| Service | Mount path | Persists |
|---|---|---|
| Sandbox | `/snapshot` | The synced knowledge base (survives deploys) |

Redis (Railway plugin) persists its own data on its volume. Postgres (Railway plugin) persists on its own volume.

## Scaling

- **Web**: stateless, horizontally scalable. Sessions live in Postgres/Redis.
- **Sandbox**: scale to match concurrent chat load; each replica shares the volume.
