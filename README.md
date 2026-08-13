# Deploy and Host a Grep-Based Knowledge Agent with Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/grep-knowledge-agent?utm_medium=integration&utm_source=button&utm_campaign=grep-knowledge-agent)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Railway Template](https://img.shields.io/badge/Railway-Deploy-blue)](https://railway.com/deploy/grep-knowledge-agent)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-purple)](https://ai-sdk.dev)
[![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82)](https://nuxt.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-8-DC382D)](https://redis.io)

A self-hosted AI knowledge agent that replaces vector embeddings with `grep`, `find`, and `cat`. Give the LLM a filesystem and `bash` — it searches your docs deterministically, explains every step, and costs ~75% less than vector RAG. No vector database, no Vercel lock-in.

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

The agent clones your GitHub repos into a snapshot volume, then uses a sandboxed shell to run read-only `grep`/`find`/`cat` commands against them. A provider-agnostic complexity router classifies each question and routes to the right model tier — cheap for trivial questions, balanced for moderate, powerful for complex — from whichever AI provider you configured. Every answer cites the files it read. Deploying on Railway gives you Postgres, Redis, persistent volumes, and private networking — all provisioned automatically with one click.

## Common Use Cases

- **Documentation Q&A** — point it at your repo's `docs/` folder and ask questions about your product
- **Codebase exploration** — let an LLM grep through your source code to answer architecture questions
- **Internal knowledge base** — sync multiple repos and search across all of them with one query
- **Self-hosted alternative** to Vercel's knowledge-agent-template — no vendor lock-in, bring your own AI keys
- **Cost-effective RAG replacement** — no embedding model, no vector DB, no chunking pipeline to maintain

## Dependencies for Grep Knowledge Agent Hosting

### Deployment Dependencies

- [Railway](https://railway.com) — hosts the web app, sandbox service, Postgres, and Redis
- [OpenRouter](https://openrouter.ai/settings/keys) (recommended) / [OpenAI](https://platform.openai.com/api-keys) / [Anthropic](https://console.anthropic.com/settings/keys) / [Google Gemini](https://aistudio.google.com/apikey) — at least one AI provider key (bring your own)
- [GitHub OAuth App](https://github.com/settings/developers) — for user authentication

### Implementation Details

| Vercel primitive | Railway replacement |
|---|---|
| Vercel Sandbox | gVisor sandbox (sidecar service with read-only grep/cat/find) |
| Vercel Blob | Railway Volume (snapshot directory) |
| NuxtHub KV | Redis (sessions, rate limits) |
| Vercel AI Gateway | Bring-your-own-key — OpenRouter, OpenAI, Anthropic, or Google Gemini |
| Vercel Cron | Railway Cron (snapshot refresh) |
| Vercel Workflow | Node + Redis job runner |

### Why Deploy on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it. By deploying this knowledge agent on Railway, you get Postgres, Redis, persistent volumes, and private networking — all provisioned automatically with one click.

---

## ✨ Features

- **No embeddings. No chunking. No vector DB.** A filesystem, `bash`, and an LLM.
- **Provider-agnostic complexity router** — classifies each question and routes to the cheapest model tier from *whatever provider you configured* (any single key works). **OpenRouter preferred** — one key unlocks every vendor's models: trivial → `openai/gpt-5.6-luna`/`claude-haiku-4-5`, moderate → `openai/gpt-5.6-terra`/`claude-sonnet-4-6`, complex → `openai/gpt-5.6-sol`/`claude-opus-4-8`.
- **Deterministic, explainable retrieval** — every answer cites the files it read, and the full command trace is in the UI.
- **GitHub sources** — point it at any public repo and it clones the docs into a searchable snapshot.
- **Bring-your-own-key** — no AI gateway lock-in. Use OpenAI, Anthropic, Google Gemini, or all three.
- **Authentication** — GitHub OAuth + email/password (Better Auth).
- **Auto-migration** — database tables are created automatically on first deploy.
- **Credit / usage metering** — token usage is recorded per user; cap usage with `MAX_TOKENS_PER_USER` to bill against credits.
- **Typed SDK** — chat app ships with `@grep/sdk` for embedding the agent anywhere.
- **Defense-in-depth security** — three layers of command validation (SDK → web → sandbox).

## 💰 Cost Comparison: Vector RAG vs Grep

| Component | Vector RAG | Grep Knowledge Agent |
|---|---|---|
| Embedding model | Required (per-token cost) | Not needed |
| Vector database | Required (Pinecone, Weaviate, pgvector) | Not needed |
| Chunking pipeline | Required (maintenance overhead) | Not needed |
| Search | Approximate nearest neighbor (ANN) | `grep` (filesystem read) |
| Explainability | Similarity scores (opaque) | Command trace (transparent) |
| **Estimated cost per 1K queries** | **~$15-30** | **~$3-8** |

> ~75% lower cost per query compared to vector RAG (based on Vercel's own measurements of the original knowledge-agent-template).

## 🚀 Quick Start

### One-Click Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/grep-knowledge-agent?utm_medium=integration&utm_source=button&utm_campaign=grep-knowledge-agent)

The template provisions everything:
- **Web service** (Nuxt 4 + Nitro) with auto-generated `BETTER_AUTH_SECRET`
- **Sandbox service** with a snapshot volume at `/snapshot`
- **PostgreSQL** → `DATABASE_URL`
- **Redis** → `REDIS_URL`

### After Deploy (just 2 steps to start chatting)

The template provisions everything: **web service** (Nuxt 4 + Nitro, auto-generated
`BETTER_AUTH_SECRET`), **sandbox service** with a snapshot volume at `/snapshot`,
**PostgreSQL** (`DATABASE_URL`), and **Redis** (`REDIS_URL`).

1. **Set one AI provider key** (bring your own — any one works):
   - `OPENROUTER_API_KEY` → [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) — **recommended** (one key, every model)
   - `OPENAI_API_KEY` → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - `ANTHROPIC_API_KEY` → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - `GOOGLE_GENERATIVE_AI_API_KEY` → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for detailed instructions.

2. **Open your app → create an account (email + password) → sign in → add a source**:
   Settings → **Add GitHub source** → enter `owner/repo` (e.g. `vercel-labs/knowledge-agent-template`) → **Sync**. Then ask it anything.

> Email/password sign-up works out-of-the-box with **zero extra setup**. GitHub OAuth is optional —
> it only appears on the login page once you set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
> ([setup guide](docs/ENVIRONMENT.md#setting-up-github-oauth)).

### Local Development

**Option A: Docker Compose (recommended)**

```bash
# Start Postgres, Redis, and the sandbox service
docker compose up -d

bun install
cp apps/web/.env.example apps/web/.env
# Edit .env: set DATABASE_URL, REDIS_URL, SANDBOX_URL (see comments in .env.example)
# Fill in at least one AI provider key + GitHub OAuth credentials
bun run db:push    # create tables
bun run dev
```

**Option B: Manual**

```bash
bun install
cp apps/web/.env.example apps/web/.env
# Fill in at least one AI provider key + GitHub OAuth credentials
# You'll need Postgres and Redis running locally
bun run db:push    # create tables
bun run dev
```

## 📋 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | ✅ (auto-generated on Railway) | Session signing secret. Auto-generates a runtime fallback if unset (sessions reset on redeploy). |
| `DATABASE_URL` | ✅ (Railway Postgres) | Postgres connection string |
| `REDIS_URL` | ✅ (Railway Redis) | Redis for sessions/rate limits/jobs |
| `OPENROUTER_API_KEY` | ✅ (one of four, recommended) | OpenRouter key — one key unlocks every model |
| `OPENAI_API_KEY` | ✅ (one of four) | OpenAI API key |
| `ANTHROPIC_API_KEY` | ✅ (one of four) | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ (one of four) | Google Gemini API key |
| `GITHUB_CLIENT_ID` | optional | GitHub OAuth client ID (enables "Continue with GitHub" on login) |
| `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth client secret |
| `SNAPSHOT_REPO` | optional | Default `owner/repo` to seed on first run |
| `PUBLIC_SITE_URL` | optional | Your public app URL (for auth). Auto-detected from Railway on deploy. |

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for where to find each value.

## 🧱 Architecture

| Package | Description |
|---|---|
| `apps/web` | Nuxt 4 + Nitro: chat UI, auth, REST API, agent loop, GitHub sync |
| `packages/agent` | AI SDK agent: complexity router, prompts, model registry |
| `packages/sdk` | Typed client + `bash`/`bash_batch` AI SDK tools, read-only shell policy |
| `sandbox-service` | gVisor sandbox: mounts snapshot volume, executes allowlisted commands |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

### Complexity Router

The router classifies each question and selects the optimal model tier + step budget. The actual model comes from whichever provider you configured (bring-your-own-key — any single key works). **OpenRouter is preferred** — one key unlocks every vendor's models:

| Complexity | Model (OpenRouter / Anthropic / OpenAI / Gemini) | Max Steps | Example |
|---|---|---|---|
| trivial | `openai/gpt-5.6-luna` / `claude-haiku-4-5` / `gpt-4o-mini` / `gemini-2.5-flash` | 4 | "Hello", "Thanks" |
| simple | `openai/gpt-5.6-luna` / `claude-haiku-4-5` / `gpt-4o-mini` / `gemini-2.5-flash` | 8 | "What is X?" |
| moderate | `openai/gpt-5.6-terra` / `claude-sonnet-4-6` / `gpt-4o` / `gemini-2.5-flash` | 15 | "Compare X and Y" |
| complex | `openai/gpt-5.6-sol` / `claude-opus-4-8` / `gpt-4o` / `gemini-2.5-flash` | 25 | "Debug this architecture issue" |


### Security Model

Three layers of command validation:

1. **SDK layer** — `validateShellCommand()` rejects disallowed commands before they leave the client
2. **Web layer** — re-validates every command before forwarding to sandbox
3. **Sandbox layer** — final validation + 15s timeout + 5MB output cap

Only the sandbox service mounts the volume — the web service has no filesystem access to the snapshot.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, security model, sync/chat flows
- [Environment Variables](docs/ENVIRONMENT.md) — how to find every API key + GitHub OAuth setup
- [Deployment](docs/DEPLOYMENT.md) — Railway deploy, manual deploy, health checks, scaling
- [Customization](docs/CUSTOMIZATION.md) — add sources, change models, extend the sandbox
- [FAQ](docs/FAQ.md) — common questions and troubleshooting
- [Contributing](CONTRIBUTING.md) — how to contribute
- [Changelog](CHANGELOG.md) — version history

## ❓ FAQ

<details>
<summary><b>How is this different from vector RAG?</b></summary>

Vector RAG chunks your docs, embeds them, stores them in a vector DB, and runs approximate-nearest-neighbor queries. This agent skips all of that — it gives the LLM a filesystem and `bash`, so it `grep`s for exact terms, reads the exact file, and cites it. No chunking, no embeddings, no vector DB, no similarity thresholds.

The result is deterministic (same question → same files read → same answer), explainable (you see every command), and ~75% cheaper.
</details>

<details>
<summary><b>Do I need all the AI provider keys?</b></summary>

No. You need **at least one**. The recommended option is **OpenRouter** — a single key (`sk-or-...`) unlocks every vendor's models through one endpoint, so you never need to create separate OpenAI / Anthropic / Google keys.

If you only have OpenAI, the router will use `gpt-4o-mini` for trivial/simple and `gpt-4o` for moderate. Complex questions will also use `gpt-4o`.
</details>

<details>
<summary><b>Is the sandbox secure?</b></summary>

Yes. The sandbox uses three layers of validation:

1. The SDK validates commands before they leave the client
2. The web service re-validates before forwarding
3. The sandbox service does final validation + enforces a 15s timeout

Only read-only commands are allowed (`grep`, `find`, `cat`, `head`, `tail`, etc.). Write operations, command substitution, interpreters, and path traversal are all blocked. The sandbox is the only service with volume access.
</details>

<details>
<summary><b>Can I use private GitHub repos?</b></summary>

Currently the sync clones public repos. To support private repos, you'd need to add a GitHub token to the sync request. See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for how to extend the sync flow.
</details>

<details>
<summary><b>How do I add my own docs?</b></summary>

1. Sign in → **Settings**
2. **Add GitHub source** → enter `owner/repo` (e.g. `nuxt/nuxt`)
3. Click **Sync** — the agent clones the repo, filters to docs files, and stores them on the snapshot volume
4. Ask questions in the chat — the agent will `grep` through your synced docs
</details>

<details>
<summary><b>What file types are indexed?</b></summary>

The sync filters to: `*.md`, `*.mdx`, `*.yml`, `*.yaml`, `*.json`. All other files are deleted from the snapshot to keep it lean. You can change this filter in `apps/web/server/api/sync.post.ts`.
</details>

## 🔗 Links

- **Deploy**: [railway.com/deploy/grep-knowledge-agent](https://railway.com/deploy/grep-knowledge-agent)
- **GitHub**: [github.com/jesseoue/grep-knowledge-agent](https://github.com/jesseoue/grep-knowledge-agent)
- **Original**: [vercel-labs/knowledge-agent-template](https://github.com/vercel-labs/knowledge-agent-template)
- **Railway Marketplace**: [railway.com/templates](https://railway.com/templates)

## 📄 License

MIT. Forked from [vercel-labs/knowledge-agent-template](https://github.com/vercel-labs/knowledge-agent-template) — the upstream copyright notice is preserved in [LICENSE](LICENSE).
