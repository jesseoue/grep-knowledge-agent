# Grep Knowledge Agent

**The knowledge agent that replaces embeddings with `grep`. Self-hosted on Railway — no vector database, no Vercel lock-in.**

Build an AI agent that stays up to date with your docs, codebases, and transcripts by giving the LLM a filesystem and `bash`. It runs `grep`, `find`, and `cat` against a snapshot of your sources — results are **deterministic, explainable, and ~75% cheaper** than vector RAG. Forked from the viral [vercel-labs/knowledge-agent-template](https://github.com/vercel-labs/knowledge-agent-template) (MIT) and rebuilt natively for Railway.

```
┌─────────────┐   ┌──────────────────────────────────────────┐   ┌──────────────┐
│  Chat UI    │──▶│  Web (Nuxt 4 + Nitro)                    │──▶│  Sandbox      │
│  /settings  │   │  · AI SDK agent loop + complexity router │   │  (gVisor)     │
│  admin      │   │  · Postgres (chats, sources, usage)      │   │  grep/cat/    │
│             │   │  · Redis (sessions, rate limits, jobs)   │   │  find (RO)    │
└─────────────┘   │  · GitHub sync → snapshot volume         │   └──────────────┘
                  └──────────────────────────────────────────┘
```

## Why this exists

Vector RAG has a silent failure mode: the agent retrieves the wrong chunk with confidence `0.82` and you can't trace why. This template inverts the architecture — instead of embedding your docs into a vector DB, it gives the agent the actual filesystem and lets it search with the tools it already knows:

```bash
grep -rl "rate limiting" docs/ --include="*.md" | head -5
head -80 docs/plans/enterprise.md
```

When the answer is wrong, you **open the trace and see exactly what happened**: it ran `grep -r "pricing" docs/`, read `docs/plans/enterprise.md`, and pulled the wrong section. You fix the file or adjust the search strategy. Debugging takes minutes, not vector-tuning sessions.

## What's Railway-native here

| Vercel primitive | Railway replacement |
|---|---|
| Vercel Sandbox | **gVisor sandbox** (sidecar service with read-only grep/cat/find) |
| Vercel Blob | **Railway Volume** (snapshot directory) |
| NuxtHub KV | **Redis Volume** (sessions, rate limits, job queue) |
| Vercel AI Gateway | **Bring-your-own-key** — OpenAI, Anthropic, or Google Gemini |
| Vercel Cron | **Railway Cron** (snapshot refresh) |
| Vercel Workflow | **Node + Redis job runner** |

Deploys with **two services** and a shared volume — one click, and Railway provisions Postgres, Redis, the volume, and generates your secrets with `${{secret()}}`.

## Quick start (local)

```bash
bun install
cp apps/web/.env.example apps/web/.env
bun run db:migrate
bun run dev
```

## One-click deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/your-template-code)

After deploy:

1. Create a GitHub OAuth app (Settings → Developer settings → OAuth Apps) with callback URL `https://<your-app>.up.railway.app/api/auth/callback/github` — set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
2. Set an AI provider key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`
3. Open your app → **Settings → Snapshot repo** → enter `owner/repo` (e.g. `vercel-labs/knowledge-agent-template`) → **Sync**
4. Ask it anything about your repo. It answers with `grep`, not vectors.

## Features

- **No embeddings. No chunking. No vector DB.** A filesystem, `bash`, and an LLM.
- **Complexity router** — a lightweight model classifies each question and routes to `gemini flash` (trivial) → `claude sonnet` (moderate) → `claude opus` (complex), budgeting steps per difficulty.
- **Deterministic, explainable retrieval** — every answer cites the files it read, and the full command trace is in the UI.
- **GitHub, YouTube, and file sources** — point it at repos, channels, or upload docs.
- **Admin panel** — manage sources, agent config, users, usage, and logs.
- **Web + API SDK** — chat app ships with a typed SDK (`@grep/sdk`) for embedding the agent anywhere.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ (generated) | Session signing secret |
| `DATABASE_URL` | ✅ (Railway) | Postgres connection string |
| `REDIS_URL` | ✅ (Railway) | Redis for sessions/rate limits/jobs |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth app |
| `OPENAI_API_KEY` *or* `ANTHROPIC_API_KEY` *or* `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | AI provider key (at least one) |
| `SNAPSHOT_REPO` | optional | Default `owner/repo` to seed on first run |

## Architecture

- **`apps/web`** — Nuxt 4 + Nitro app: chat UI, admin, REST API, agent loop, GitHub sync, job runner
- **`packages/agent`** — the AI SDK agent: complexity router, prompts, tool loop
- **`packages/sdk`** — typed client + `bash`/`bash_batch` AI SDK tools, read-only shell policy
- **`sandbox-service`** — gVisor sandbox: mounts the snapshot volume, executes allowlisted read-only commands

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

## License

MIT. Forked from [vercel-labs/knowledge-agent-template](https://github.com/vercel-labs/knowledge-agent-template) — the upstream copyright notice is preserved in [LICENSE](LICENSE).
