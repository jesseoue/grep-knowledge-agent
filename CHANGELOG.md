# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-08-12

### Added — OpenRouter as the recommended AI provider
- **OpenRouter support**: the app now speaks the [OpenRouter](https://openrouter.ai) API (`@ai-sdk/openai-compatible`) via a single `OPENROUTER_API_KEY`. One key unlocks every vendor's models — no need to create separate OpenAI / Anthropic / Google keys.
- **OpenRouter is the preferred provider**: `PROVIDER_PRIORITY` is now `openrouter → anthropic → openai → gemini`. If only an OpenRouter key is set, the app uses OpenRouter models exclusively.
- **Model tiers updated to current models**: the registry now points at verified, current model IDs from the live OpenRouter catalog — cheap `openai/gpt-5.6-luna`, balanced `openai/gpt-5.6-terra`, powerful `openai/gpt-5.6-sol` (plus the existing direct-provider IDs for Anthropic / OpenAI / Gemini).
- **Custom headers for OpenRouter attribution**: requests include `HTTP-Referer` and `X-Title` so usage shows up in the OpenRouter dashboard.
- **Docs updated everywhere**: `README.md`, `docs/ENVIRONMENT.md`, `docs/ARCHITECTURE.md`, `docs/CUSTOMIZATION.md`, `docs/FAQ.md`, `docs/DEPLOYMENT.md`, and `apps/web/.env.example` now lead with OpenRouter as the recommended setup.

## [1.3.2] - 2026-08-12

### Fixed — one-click login (the critical one)
- **`usePlural` for the Better Auth Drizzle adapter**: the schema uses plural table names (`users`/`sessions`/`accounts`/`verifications`) but Better Auth's default models are singular. Without `usePlural: true`, every email/password signup and signin returned **500** ("The model \"user\" was not found in the schema object") — the one-click deploy produced an app you couldn't log into.
- **Migration was closing the shared DB pool**: `plugins/migrate.ts` called `sql.end()` on the app's connection pool after startup migrations, so *every* subsequent DB query (auth, chat, usage) failed with "write CONNECTION_ENDED". Migrations now run on their own short-lived connection that closes itself, leaving the app pool intact.
- Verified end-to-end on production: register → 200 + token, then sign in (consecutive) → 200 + token, with a secure `HttpOnly`/`Secure` session cookie.

## [1.3.1] - 2026-08-12

### One-click simplicity
- **Password-first auth**: email/password is now the primary login (works with zero setup on a fresh deploy). "Continue with GitHub" is secondary and only appears when `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are actually configured (via a new `GET /api/auth/config` endpoint).
- **Docs updated**: README "After Deploy" is now a clean 2-step flow (set one AI key → sign up + add a source). GitHub OAuth documented as optional.

## [1.3.0] - 2026-08-12

### Fixed — critical runtime bugs
- **Retired model IDs**: the registry pointed at `claude-sonnet-4-20250514` / `claude-opus-4-20250514` (retired June 15, 2026) and `gemini-2.0-flash` (shut down June 1, 2026), so any chat call would fail. Migrated to current models: `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`, `gemini-2.5-flash`.
- **Provider-agnostic router**: the router hard-depended on Anthropic (`claude-haiku-4`). Now it works with **any single API key** (OpenAI / Anthropic / Gemini), picking the right model per question complexity via a tiered registry with provider fallback.
- **Broken sync**: the compound `if … fi` clone command was rejected by `validateSyncCommand`, so `POST /api/sync` always failed. Replaced with simple, allowed commands.
- **Missing `git`**: the sandbox Docker image didn't install `git`, so repo cloning could never work. Added `git` + `ca-certificates`.

### Security
- **Command injection fixed**: `sync.post.ts` interpolated unsanitized `repo`/`branch` into shell strings. Added strict `owner/repo` + branch regex validation at the API boundary (and re-validates DB-stored repos).

### Added — credit / usage metering
- **`usage` ledger table** (append-only) recording token usage per request, with auto-migration.
- **`MAX_TOKENS_PER_USER`** quota — cap all-time token usage per user (0 = unlimited) to bill against credits.
- **`GET /api/usage`** endpoint + quota check in the chat flow + a "credits" meter in the command-trace sidebar.

### Cleanup
- Removed dead code: unused `resolveModel`/`resolveDefaultModel`/`providerForModelId`, stale `MODEL_ALIASES` docs references.
- Updated `ENVIRONMENT.md`, `FAQ.md`, `CUSTOMIZATION.md`, `ARCHITECTURE.md`, `README.md` to reflect the new tiered model routing and quota env var.

## [1.2.2] - 2026-08-12

### Added — SEO & polish
- **SEO metadata**: title, meta description, keywords, robots, Open Graph, and Twitter cards via `useSeoMeta` in `app.vue` (single source of truth — no duplicate `<meta>` tags).
- **Custom favicon** (`favicon.svg`) and **Open Graph image** (`og.png`, 1200×630) in the Terminal Noir aesthetic.
- **`theme-color`** meta for mobile browser chrome.

### Cleanup
- Removed empty `server/middleware/` and `server/utils/` directories.
- Removed stale `railway-template-readme.md` references from `.dockerignore` and `.gitignore`.
- Consolidated duplicated SEO head config (was split across `app.vue` and `nuxt.config.ts`).
- Confirmed no leaked API keys in source (full scan).

## [1.2.1] - 2026-08-12

### Fixed — production deploy
- **Docker port binding**: removed hardcoded `NITRO_PORT=3000` from the web Dockerfile. It was overriding Railway's injected `$PORT` (8080), so the container listened on the wrong port and deploys failed. Nitro now resolves `NITRO_PORT || PORT` correctly.
- **Better Auth baseURL**: set the canonical base URL from `PUBLIC_SITE_URL` → `RAILWAY_PUBLIC_DOMAIN` → localhost. Fixes the "Base URL could not be determined" warning that breaks OAuth callbacks/redirects.
- **SSR auth client baseURL**: mirrors the same resolution in the Vue auth client.

## [1.2.0] - 2026-08-12

### Added — Terminal Noir UI redesign
- **Distinctive "Terminal Noir" aesthetic**: deep ink-black theme with CRT scanline overlay, ambient glow, and grid backdrop — honest to the grep/bash product (no more generic gray/white "AI slop").
- **JetBrains Mono** loaded via Google Fonts, replacing the generic Inter/system font.
- **Terminal-window chrome** (title bar, traffic-light dots, `$` prompt) across all pages.
- **Blinking cursor**, staggered `.rise` reveals, and typing effects.
- **Login page**: cinematic two-column layout with an animated `grep` terminal hero showing live search results.
- **Chat page**: markdown-rendered assistant answers via `@nuxtjs/mdc` (previously raw `<pre>` text), plus file-reference chips.
- **Command trace sidebar**: real-time panel showing every `grep`/`cat` command the agent ran — matching the original Vercel template's tool-visualization feature.
- **Empty-state terminal**: `zsh — 80×24` window that invites the first question.

### Changed
- `chats.post.ts` now returns a `trace` array (the shell commands the agent ran) alongside `references` and `usage`.
- Added reusable `ChatMessage.vue` component (DRY).
- `app.config.ts` sets primary color to amber for a cohesive warm terminal accent.

## [1.1.1] - 2026-08-12

### Fixed
- **Security**: removed hardcoded `'dev-secret-change-me'` fallback in `auth.ts`. The app now auto-generates an ephemeral runtime secret (with a warning) if `BETTER_AUTH_SECRET` is unset — no known-secret vulnerability.
- **One-click OAuth**: `trustedOrigins` now auto-includes `RAILWAY_PUBLIC_DOMAIN` and `RAILWAY_STATIC_URL`, so GitHub OAuth callbacks work out-of-the-box on `*.up.railway.app` without setting `PUBLIC_SITE_URL`.
- **Settings page**: the "Snapshot repository" field is now wired up — typing an `owner/repo` and clicking Sync actually clones it (previously a dead input).

### Changed
- `sync.post.ts` now accepts a `repo`/`branch` in the body to sync a raw repo without a DB source record.
- `docs/ENVIRONMENT.md` and `README.md` updated to document auto-generated secret + trusted origins auto-detection.

## [1.1.0] - 2026-08-12

### Added
- Rate limiting on chat endpoint (20 req/min per user, Redis-backed with in-memory fallback)
- `abortSignal` propagation — disconnecting stops model generation and billing
- Per-step and total token usage logging for cost attribution
- Token usage returned in chat response (`usage.inputTokens`, `usage.outputTokens`, `usage.totalTokens`)
- `docker-compose.yml` for local development with Postgres, Redis, and sandbox
- `.dockerignore` for lean Docker builds
- `HEALTHCHECK` in both Dockerfiles (Node-based, no curl needed)
- Non-root user (`node`) in both Docker containers
- `NITRO_PORT` / `NITRO_HOST` env vars in web Dockerfile
- `.chown` on sandbox Dockerfile COPY for non-root compatibility

### Changed
- Dockerfiles improved: multi-stage with non-root user, HEALTHCHECK, proper env vars
- `.env.example` now includes docker-compose defaults
- README updated with Docker Compose quick start option
- DEPLOYMENT.md updated with Docker build/run instructions

### Removed
- `railway.toml` (redundant with `railway.json` — DRY)
- Empty directories: `packages/agent/src/agents`, `packages/agent/src/core`, `packages/agent/src/tools`

## [1.0.0] - 2026-08-11

### Added
- Self-hosted knowledge agent that replaces embeddings with `grep`, `find`, and `cat`
- Nuxt 4 + Nitro web app with chat UI and settings page
- gVisor sandbox service for read-only shell execution over a snapshot volume
- Complexity router — lightweight model classifies questions and routes to the right model
- Bring-your-own-key AI provider support: OpenAI, Anthropic, Google Gemini
- GitHub OAuth + email/password authentication (Better Auth)
- GitHub source sync — clone repos into a searchable snapshot
- Typed SDK (`@grep/sdk`) with `bash`/`bash_batch` AI SDK tools
- Read-only shell policy with allowlisted commands and path restrictions
- Railway-native: volumes, private networking, health checks, config-as-code
- Auto-migration on startup — no manual DB setup required
