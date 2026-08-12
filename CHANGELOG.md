# Changelog

All notable changes to this project will be documented in this file.

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
