# Changelog

All notable changes to this project will be documented in this file.

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
