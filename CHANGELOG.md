# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Improved

- Added an atomic UTC daily LLM budget with OpenRouter cost reconciliation, fail-safe reservations, an emergency kill switch, optional router bypass, bounded output/steps/model tier/rate, and a live remaining-budget meter.
- Made first-owner setup unmistakable: fresh deployments lead with **Create owner**, while claimed deployments explain why signup is closed and link to safe recovery.
- Added an operator-only Railway SSH recovery utility, generated temporary-password support, session revocation, and an authenticated in-app password-change panel.
- Reworked the public landing page, first-run settings, chat shell, README, social preview, and responsive states around the outcome-led promise: **Search your code. See the proof.**
- Added canonical and social URLs, route-aware indexing controls, `SoftwareApplication` JSON-LD, a generated sitemap, and a sitemap-aware robots response.
- Updated Railway config-as-code to the supported Dockerfile builder with graceful deploy overlap/draining, minimized both runtime images, and made lockfile failures fail the build.
- Added a pinned, least-privilege GitHub Actions release gate and a private vulnerability-reporting policy.
- Added GitHub URL normalization, sparse `contentPath` sync, direct-sync precedence, idempotent demo setup, strict failure reporting, and safer source validation.
- Made readiness checks cover PostgreSQL, Redis, and the sandbox while allowing a fresh deployment to report `needs_configuration` until an AI key is added.
- Aligned the workspace dependency graph and added repeatable security/input tests.

### Fixed

- Removed the Nuxt hydration mismatch, fixed repeated-message loading feedback, honored safe post-login redirects, and restored the Redis-unavailable rate-limit fallback.
- Confined sandbox working directories to the snapshot root and blocked write/execute modes hidden behind otherwise read-oriented shell tools.
- Closed public registration after the first workspace owner by default, with an explicit `ALLOW_PUBLIC_SIGNUP=true` opt-in for shared deployments.
- Replaced unsupported cost and runtime-isolation claims in the current documentation with verifiable behavior and limits.

## [1.5.0] - 2026-08-12

### Added — streaming chat + template polish
- **Streaming responses**: chat now streams tokens via SSE (`streamText`) instead of waiting for the full response. Text appears incrementally as the model generates it, with the command trace + references delivered in a final `done` event.
- **Template icon**: added a 512×512 transparent PNG icon (`assets/icon.png`) for the Railway marketplace card. Every competing template has one — this was a best-practices gap.
- **Friendly quota errors**: credit-quota exhaustion now returns HTTP 402 with a clear message ("You've used X of Y tokens") instead of a generic 500, so the UI can show "out of credits" cleanly.
- **Quota-exceeded banner**: the UI now shows a dismissible amber banner when the user hits their token quota, instead of a silent error.
- **Rate-limit notice**: a transient cyan banner appears when the user sends requests too fast (HTTP 429).
- **One-click demo source**: a "try the demo" button adds a pre-configured source (`vercel-labs/knowledge-agent-template`) and syncs it automatically — new users can test the agent without typing a repo URL.
- **Clear chat button**: users can start a fresh conversation with a "clear" button in the header.
- **Clickable example prompts**: the empty-state examples are now buttons that send the prompt when clicked.
- **Copy-to-clipboard**: assistant answers have a copy button that appears on hover.
- **Cmd/Ctrl+Enter shortcut**: users can send messages with ⌘+Enter (in addition to Enter).
- **Multi-source indicator**: the trace sidebar now shows which sources/repos are being searched.
- **Error page**: added a themed `error.vue` (Terminal Noir 404/500 page) instead of the default Nuxt error.
- **Sandbox retry/backoff**: the web service now retries sandbox connections up to 3 times with exponential backoff (500ms → 1s → 2s) on cold starts, instead of failing immediately.
- **robots.txt**: added to allow search engine indexing of the landing page while blocking API routes.

### Fixed
- **Dockerfile EXPOSE**: changed `EXPOSE 3000` → `EXPOSE 8080` to match Railway's injected `$PORT`. The old value was informational-only but failed template validators and confused readers.
- **Sandbox permissions**: the sandbox Dockerfile now runs as root (the container is already isolated via gVisor + read-only command allowlist) and pre-creates `/snapshot/gh`, fixing "Permission denied" on repo sync after fresh deploys.
- **Provider error message**: updated the "no AI provider" error to mention `OPENROUTER_API_KEY` (recommended) first.
- **LICENSE**: clarified copyright attribution (year, email, upstream derivation notice).

### Updated
- **Dependencies**: bumped `ai` (6→7), `@ai-sdk/*` (2→4), `better-auth` (1.5→1.6), `@nuxtjs/mdc` (0.20→0.23) to latest. All typechecks and builds pass.
- **Favicon**: updated to match the new template icon design.

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
