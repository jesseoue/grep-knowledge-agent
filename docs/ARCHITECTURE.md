# Architecture

This document explains how the Grep Knowledge Agent works — and why it replaces vector RAG with a filesystem and `bash`.

## Core idea

Instead of chunking, embedding, and storing your knowledge base in a vector database, the agent gets the actual files and uses `grep`, `find`, and `cat` to search them. This is:

- **Inspectable** — you can see exactly which commands the agent ran and which files it read.
- **Direct** — search operates on the source files instead of a derived embedding index.
- **Lean** — no embedding model, vector database, or chunking pipeline is required.
- **Easy to debug** — failed retrieval is visible in the command trace.

## System diagram

```
┌─────────────┐    ┌──────────────────────────────────────────┐    ┌──────────────┐
│  Chat UI    │───▶│  Web (Nuxt 4 + Nitro)                    │───▶│  Sandbox      │
│  /settings  │    │  · Agent loop (AI SDK)                   │    │  (sidecar)    │
│  admin      │    │  · Complexity router                     │    │  grep/find/   │
└─────────────┘    │  · PostgreSQL (chats, sources, users)    │    │  cat (read-   │
                   │  · Redis (rate limits, coordination)    │    │  only policy)│
                   │  · GitHub sync → snapshot volume         │    └──────────────┘
                   └──────────────────────────────────────────┘
                                   │  shared volume (snapshot repo)
                                   ▼
                          ┌───────────────────┐
                          │  /snapshot        │
                          │  gh/<owner>_<repo>│
                          │  (cloned sources) │
                          └───────────────────┘
```

## Services

### 1. Web service (`apps/web`)

Nuxt 4 + Nitro application that serves:

- **Chat UI** — streaming agent conversations
- **Settings** — add/manage sources, trigger syncs
- **REST API** — `POST /api/chats`, `POST /api/sandbox/shell`, `POST /api/sync`, `GET /api/sources`
- **Agent loop** — the AI SDK's `generateText` with tool calls: the model decides which `bash` commands to run, executes them through the sandbox, and composes an answer with citations.
- **Complexity router** — a lightweight model classifies each question into `trivial | simple | moderate | complex`, selecting the step budget (4/8/15/25) and the model tier:
  - trivial / simple → cheap tier (`openai/gpt-5.6-luna` via OpenRouter / `claude-haiku-4-5` / `gpt-4o-mini` / `gemini-2.5-flash`)
  - moderate → balanced tier (`openai/gpt-5.6-terra` / `claude-sonnet-4-6` / `gpt-4o` / `gemini-2.5-flash`)
  - complex → powerful tier (`openai/gpt-5.6-sol` / `claude-opus-4-8` / `gpt-4o` / `gemini-2.5-flash`)
  - The router is **provider-agnostic**: any single API key (OpenRouter, OpenAI, Anthropic, or Gemini) is enough — it picks the right model from that provider. OpenRouter is preferred when set, because one key unlocks every vendor's models.
- **GitHub sync** — clones configured `owner/repo` sources into the snapshot volume, keeping only docs files (`*.md`, `*.mdx`, `*.yml`, `*.yaml`, `*.json`).

### 2. Sandbox service (`sandbox-service`)

A tiny Node HTTP server that is the **only** service with the snapshot volume mounted. It exposes two endpoints:

- **`POST /run`** — read-only commands for the AI agent (grep/find/cat). Validated through the strict read-only shell policy.
- **`POST /sync-run`** — sync commands for the web service (git/mkdir/find for repo cloning). Validated through a separate sync policy that allows write operations but still blocks dangerous patterns and restricts paths to `/snapshot`.

Both endpoints:

- Executes commands via `execFile` against `bash -c` (read-only policy enforced first)
- **Allowlists read commands**: `find`, `ls`, `tree`, `grep`, `egrep`, `fgrep`, `cat`, `head`, `tail`, `wc`, `sort`, `cut`, `tr`, `column`, `echo`, `printf`, `test`, `[`, `true`, `false`, `basename`, `dirname`, `realpath`, `stat`, `du`, `diff`, `comm`, `md5sum`, `sha256sum`
- **Blocks dangerous patterns and modes**: command/process substitution, backticks, `eval`, `exec`, nested shells, write redirection, interpreter entry points, and write/execute modes exposed by otherwise read-oriented utilities
- **Restricts paths** to `SNAPSHOT_DIR` (default `/snapshot`) — no traversal outside the volume
- Enforces a 120-second execution timeout and 10 MiB raw output cap per command; the web layer further trims returned output to 50,000 characters

The web service reaches it over the Railway private network (`SANDBOX_URL`, default `http://sandbox.railway.internal:3200`).

### 3. Data layer

| Store | Railway primitive | Purpose |
|---|---|---|
| PostgreSQL | Railway Postgres plugin | Users, chats, messages, sources, agent config, usage ledger |
| Redis | Railway Redis + volume | Sandbox sessions, rate limits |
| Snapshot | Railway Volume | The actual cloned knowledge base that the sandbox searches |

## Security model

The sandbox service is the security boundary. The web service sends commands, but:

1. The SDK's `validateShellCommand` rejects disallowed commands/paths before they leave the client.
2. The web service re-validates every command before forwarding.
3. The sandbox re-validates, confines paths to the snapshot root, and enforces execution and output limits.
4. Only the sandbox service mounts the volume — the web service has no filesystem access to the snapshot, so a compromised API can't read arbitrary files.

This is defense-in-depth: even if one validation layer is bypassed, the next catches it.

## Sync flow

```
User adds source (owner/repo)  →  POST /api/sources
User clicks "Sync"             →  POST /api/sync
                                   │
                                   ├─ web → sandbox /sync-run:
                                   │        git clone --filter=blob:none --no-checkout
                                   │          https://github.com/<owner>/<repo>.git
                                   │          /snapshot/gh/<owner>_<repo>
                                   │        git sparse-checkout (when contentPath is set)
                                   │        find ... -delete  (supported text formats only)
                                   │        find ... -type d -empty -delete
                                   └─ sandbox volume updated → agent can grep it
```

## Chat flow

```
User message → POST /api/chats
              ├─ rate limit check (Redis or in-memory, 20 req/min per user)
              ├─ atomic daily USD reservation (DAILY_LLM_BUDGET_USD, optional)
              ├─ legacy token quota check (MAX_TOKENS_PER_USER, optional)
              ├─ router model classifies complexity (4/8/15/25 steps)
              ├─ main model instantiated from complexity tier + provider keys
              ├─ generateText with bash tools:
              │    ├─ abortSignal (2-min cap, stops on disconnect)
              │    ├─ bash / bash_batch tool → POST /api/sandbox/shell
              │    │                          → sandbox grep/find/cat
              │    └─ compose answer + citations
              ├─ usage recorded to the `usage` ledger (credit metering)
              └─ response returns { text, references, trace, usage }
                 - trace: every shell command the agent ran (drives the
                   "command trace" sidebar in the UI — no black box)
                 - references: files cited (file-name chips under the answer)
```

## UI / frontend

The frontend follows a **"Terminal Noir"** aesthetic — a CRT/command-line look that's
honest to the product (filesystem + bash + LLM, no vector DB). Key pieces:

- `app/config.ts` — Nuxt UI theme (primary = amber)
- `app/assets/css/main.css` — Tailwind + Nuxt UI theme, JetBrains Mono, scanline/grid overlays
- `app/components/ChatMessage.vue` — reusable chat bubble; renders assistant answers as markdown via `@nuxtjs/mdc`
- `app/pages/index.vue` — chat UI with a collapsible "command trace" sidebar
- `app/pages/login.vue` — split layout with an animated `grep` terminal hero
- `app/pages/settings.vue` — source management + sync

## Why not a vector DB?

Vector search answers "what's semantically near this chunk?" — which silently fails on structured questions ("how do I set the rate limit to 60 req/min?") because the right answer lives in one specific file that scored 0.79 against a wrong-but-similar chunk that scored 0.82.

Filesystem search answers the question directly: the agent `grep`s for the exact terms, reads the exact file, and cites it. When it's wrong, you see *why* in seconds. No chunk boundary tuning, no embedding model drift, no similarity thresholds in the dark.
