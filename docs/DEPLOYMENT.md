# Deployment

## One-click on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/grep-knowledge-agent?utm_medium=integration&utm_source=button&utm_campaign=grep-knowledge-agent)

The template provisions:

- **Web service** (Nuxt + Nitro) with `${{secret()}}`-generated `BETTER_AUTH_SECRET`
- **Sandbox service** with a snapshot volume at `/snapshot`
- **PostgreSQL** (Railway plugin) → `DATABASE_URL`
- **Redis** (Railway plugin) → `REDIS_URL`

The template also generates and shares `BETTER_AUTH_SECRET` and `SANDBOX_SECRET`, connects services over Railway private networking, configures both health checks, and mounts persistent storage. The deployer only needs to enter one AI provider key.

### After deploy

1. Set an AI provider key — at least one of:
   - `OPENROUTER_API_KEY` → <https://openrouter.ai/settings/keys> — **recommended** (one key, every model)
   - `OPENAI_API_KEY` → <https://platform.openai.com/api-keys>
   - `ANTHROPIC_API_KEY` → <https://console.anthropic.com/settings/keys>
   - `GOOGLE_GENERATIVE_AI_API_KEY` → <https://aistudio.google.com/apikey>

   See [ENVIRONMENT.md](ENVIRONMENT.md) for detailed instructions.

2. Open your app and choose **Create owner**. The first account claims the deployment, and public signup closes automatically. GitHub OAuth is optional; set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` only if you want GitHub sign-in.

3. Open **Settings** → load the demo source or add a public GitHub source (e.g. `vercel-labs/knowledge-agent-template`) → **Sync**.

4. Ask it anything. It answers with `grep`, not vectors.

### Owner login and recovery

The login screen has two deliberate states:

- **First-run setup** — no account exists, so **Create owner** is shown by default.
- **Owner setup complete** — the workspace is already claimed, so only sign-in is shown.

If the owner password is lost, use Railway SSH rather than reopening public signup:

```bash
railway login
railway link
railway ssh -s web
node apps/web/.output/server/recover-owner.mjs
```

The recovery utility runs inside the private web service, hashes the replacement password with Better Auth's configured password hasher, updates only the selected existing account, and revokes its sessions. Password entry is hidden. No recovery route is exposed on the public app.

For a generated temporary password:

```bash
railway ssh -s web "node apps/web/.output/server/recover-owner.mjs --email owner@example.com --generate --yes"
```

After signing in, change the temporary password under **Settings → Workspace security**. Workspace data is not deleted by either recovery path.

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
  -e OPENROUTER_API_KEY=... \
  grep-agent-web

# Build and run the sandbox service
docker build -f sandbox-service/Dockerfile -t grep-agent-sandbox .
docker run -p 3200:3200 -v /tmp/snapshot:/snapshot grep-agent-sandbox
```

## Railway config

- `railway.json` — root config-as-code: Dockerfile builds, healthcheck at `/api/health`, always-restart policy, and graceful deployment overlap/draining.
- `apps/web/Dockerfile` — multi-stage: bun install → Nuxt build → minimal node runtime, including the Railway SSH owner-recovery utility.
- `sandbox-service/Dockerfile` — bundled TypeScript server on node slim + grep/find/coreutils.

The template composer sets `RAILWAY_DOCKERFILE_PATH` separately for the web and sandbox services because this is a monorepo. Keep those paths as `/apps/web/Dockerfile` and `/sandbox-service/Dockerfile` when cloning the template manually.

## Health checks

- Web: `GET /api/health` checks PostgreSQL, Redis, the sandbox, and AI-provider configuration. It returns `503` when infrastructure is unavailable; a fresh deploy without an AI key returns `200` with `needs_configuration` so the owner can finish setup.
- Sandbox: `GET /health` or `GET /api/health` → `{"status":"ok"}`

## Volumes

| Service | Mount path | Persists |
|---|---|---|
| Sandbox | `/snapshot` | The synced knowledge base (survives deploys) |

Redis (Railway plugin) persists its own data on its volume. Postgres (Railway plugin) persists on its own volume.

## Scaling

- **Web**: stateless, horizontally scalable. Sessions live in Postgres/Redis.
- **Sandbox**: scale to match concurrent chat load; each replica shares the volume.
