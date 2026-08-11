# Grep Knowledge Agent

**Deploy and Host a Grep-Based Knowledge Agent with Railway**

A self-hosted AI knowledge agent that replaces vector embeddings with `grep`, `find`, and `cat`. Give the LLM a filesystem and `bash` — it searches your docs deterministically, explains every step, and costs ~75% less than vector RAG. No vector database, no Vercel lock-in.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/grep-knowledge-agent)

```
┌─────────────┐   ┌──────────────────────────────────────────┐   ┌──────────────┐
│  Chat UI    │──▶│  Web (Nuxt 4 + Nitro)                    │──▶│  Sandbox      │
│  /settings  │   │  · AI SDK agent loop + complexity router │   │  (gVisor)     │
│  /login     │   │  · Postgres (chats, sources, users)      │   │  grep/cat/    │
│             │   │  · Redis (sessions, rate limits)         │   │  find (RO)    │
└─────────────┘   │  · GitHub sync → snapshot volume         │   └──────────────┘
                  └──────────────────────────────────────────┘
```

## About Hosting a Grep Knowledge Agent

The agent clones your GitHub repos into a snapshot volume, then uses a sandboxed shell to run read-only `grep`/`find`/`cat` commands against them. A complexity router classifies each question and routes to the right model — `gemini-2.0-flash` for trivial questions, `claude-sonnet-4` for moderate, `claude-opus-4` for complex. Every answer cites the files it read. Deploying on Railway gives you Postgres, Redis, a persistent volume, and private networking between services — all provisioned automatically.

## Common Use Cases

- **Documentation Q&A** — point it at your repo's `docs/` folder and ask questions about your product
- **Codebase exploration** — let an LLM grep through your source code to answer architecture questions
- **Internal knowledge base** — sync multiple repos and search across all of them with one query
- **Self-hosted alternative** to Vercel's knowledge-agent-template — no vendor lock-in, bring your own AI keys

## Dependencies

### Deployment Dependencies

- [Railway](https://railway.com) — hosts the web app, sandbox service, Postgres, and Redis
- [OpenAI](https://platform.openai.com/api-keys) / [Anthropic](https://console.anthropic.com/settings/keys) / [Google Gemini](https://aistudio.google.com/apikey) — at least one AI provider key (bring your own)
- [GitHub OAuth App](https://github.com/settings/developers) — for user authentication

### Implementation Details

| Vercel primitive | Railway replacement |
|---|---|
| Vercel Sandbox | gVisor sandbox (sidecar service with read-only grep/cat/find) |
| Vercel Blob | Railway Volume (snapshot directory) |
| NuxtHub KV | Redis (sessions, rate limits) |
| Vercel AI Gateway | Bring-your-own-key — OpenAI, Anthropic, or Google Gemini |
| Vercel Cron | Railway Cron (snapshot refresh) |
| Vercel Workflow | Node + Redis job runner |

### Why Deploy on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it. By deploying this knowledge agent on Railway, you get Postgres, Redis, persistent volumes, and private networking — all provisioned automatically with one click.

## Quick start (local)

```bash
bun install
cp apps/web/.env.example apps/web/.env
# Fill in at least one AI provider key + GitHub OAuth credentials
bun run db:push    # create tables
bun run dev
```

## After deploy

1. **Set an AI provider key** — at least one of:
   - `OPENAI_API_KEY` → <https://platform.openai.com/api-keys>
   - `ANTHROPIC_API_KEY` → <https://console.anthropic.com/settings/keys>
   - `GOOGLE_GENERATIVE_AI_API_KEY` → <https://aistudio.google.com/apikey>

   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for detailed instructions.

2. **Create a GitHub OAuth app** (Settings → Developer settings → OAuth Apps) with callback URL `https://<your-app>.up.railway.app/api/auth/callback/github` — set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

3. Open your app → sign in → **Settings → Add GitHub source** → enter `owner/repo` (e.g. `vercel-labs/knowledge-agent-template`) → **Sync**

4. Ask it anything about your repo. It answers with `grep`, not vectors.

## Features

- **No embeddings. No chunking. No vector DB.** A filesystem, `bash`, and an LLM.
- **Complexity router** — a lightweight model classifies each question and routes to `gemini-2.0-flash` (trivial) → `claude-sonnet-4` (moderate) → `claude-opus-4` (complex), budgeting steps per difficulty.
- **Deterministic, explainable retrieval** — every answer cites the files it read, and the full command trace is in the UI.
- **GitHub sources** — point it at any public repo and it clones the docs into a searchable snapshot.
- **Bring-your-own-key** — no AI gateway lock-in. Use OpenAI, Anthropic, Google Gemini, or all three.
- **Authentication** — GitHub OAuth + email/password (Better Auth).
- **Auto-migration** — database tables are created automatically on first deploy.
- **Web + API SDK** — chat app ships with a typed SDK (`@grep/sdk`) for embedding the agent anywhere.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ (auto-generated on Railway) | Session signing secret |
| `DATABASE_URL` | ✅ (Railway Postgres) | Postgres connection string |
| `REDIS_URL` | ✅ (Railway Redis) | Redis for sessions/rate limits/jobs |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth app |
| `OPENAI_API_KEY` *or* `ANTHROPIC_API_KEY` *or* `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | AI provider key (at least one) |
| `SNAPSHOT_REPO` | optional | Default `owner/repo` to seed on first run |

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for where to find each value.

## Architecture

- **`apps/web`** — Nuxt 4 + Nitro app: chat UI, auth, REST API, agent loop, GitHub sync
- **`packages/agent`** — the AI SDK agent: complexity router, prompts, model registry, tool loop
- **`packages/sdk`** — typed client + `bash`/`bash_batch` AI SDK tools, read-only shell policy
- **`sandbox-service`** — gVisor sandbox: mounts the snapshot volume, executes allowlisted read-only commands

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

## License

MIT. Forked from [vercel-labs/knowledge-agent-template](https://github.com/vercel-labs/knowledge-agent-template) — the upstream copyright notice is preserved in [LICENSE](LICENSE).
