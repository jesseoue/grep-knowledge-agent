# Deployment

## One-click on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/your-template-code)

The template provisions:

- **Web service** (Nuxt + Nitro) with `${{secret()}}`-generated `BETTER_AUTH_SECRET`
- **Sandbox service** with a snapshot volume at `/snapshot`
- **PostgreSQL** (Railway plugin) → `DATABASE_URL`
- **Redis** (Railway plugin) → `REDIS_URL`

### After deploy

1. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (see [ENVIRONMENT.md](ENVIRONMENT.md)).
2. Set at least one AI provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`).
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

## Railway config

- `railway.json` / `railway.toml` — root config-as-code: Nixpacks build, healthcheck at `/api/health`, restart-on-failure.
- `apps/web/Dockerfile` — multi-stage: bun install → Nuxt build → minimal node runtime.
- `sandbox-service/Dockerfile` — node slim + grep/find/coreutils.

## Health checks

- Web: `GET /api/health` → `{"status":"ok"}` (used by Railway readiness check)
- Sandbox: `GET /health` → `{"status":"ok"}`

## Volumes

| Service | Mount path | Persists |
|---|---|---|
| Sandbox | `/snapshot` | The synced knowledge base (survives deploys) |

Redis (Railway plugin) persists its own data on its volume. Postgres (Railway plugin) persists on its own volume.

## Scaling

- **Web**: stateless, horizontally scalable. Sessions live in Postgres/Redis.
- **Sandbox**: scale to match concurrent chat load; each replica shares the volume.
