# Changelog

All notable changes to this project will be documented in this file.

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
