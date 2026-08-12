# Architecture

This document explains how the Grep Knowledge Agent works — and why it replaces vector RAG with a filesystem and `bash`.

## Core idea

Instead of chunking, embedding, and storing your knowledge base in a vector database, the agent gets the actual files and uses `grep`, `find`, and `cat` to search them. This is:

- **Deterministic** — same question, same files read, same answer.
- **Explainable** — you can see exactly which commands the agent ran and which files it read.
- **Cheap** — no embedding model, no vector DB, no chunking pipeline. ~75% lower cost per call (Vercel's own measurements).
- **Fast** — the search is a filesystem read, not an approximate-nearest-neighbor query.

## System diagram

```
┌─────────────┐    ┌──────────────────────────────────────────┐    ┌──────────────┐
│  Chat UI    │───▶│  Web (Nuxt 4 + Nitro)                    │───▶│  Sandbox      │
│  /settings  │    │  · Agent loop (AI SDK)                   │    │  (sidecar)    │
│  admin      │    │  · Complexity router                     │    │  grep/find/   │
└─────────────┘    │  · PostgreSQL (chats, sources, users)    │    │  cat (read-   │
                   │  · Redis (sessions, rate limits)         │    │  only, gVisor)│
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
- **Complexity router** — a lightweight model classifies each question into `trivial | simple | moderate | complex`, selecting the model and step budget:
  - trivial (4 steps) → `gemini-2.0-flash` or `gpt-4o-mini`
  - simple (8 steps) → `gemini-2.0-flash` or `gpt-4o-mini`
  - moderate (15 steps) → `claude-sonnet-4` / `gpt-4o`
  - complex (25 steps) → `claude-opus-4`
- **GitHub sync** — clones configured `owner/repo` sources into the snapshot volume, keeping only docs files (`*.md`, `*.mdx`, `*.yml`, `*.yaml`, `*.json`).

### 2. Sandbox service (`sandbox-service`)

A tiny Node HTTP server that is the **only** service with the snapshot volume mounted. It exposes two endpoints:

- **`POST /run`** — read-only commands for the AI agent (grep/find/cat). Validated through the strict read-only shell policy.
- **`POST /sync-run`** — sync commands for the web service (git/mkdir/find for repo cloning). Validated through a separate sync policy that allows write operations but still blocks dangerous patterns and restricts paths to `/snapshot`.

Both endpoints:

- Executes commands via `execFile` against `bash -c` (read-only policy enforced first)
- **Allowlists commands**: `find`, `ls`, `tree`, `grep`, `egrep`, `fgrep`, `cat`, `head`, `tail`, `less`, `more`, `wc`, `sort`, `uniq`, `cut`, `awk`, `sed`, `tr`, `column`, `echo`, `printf`, `test`, `[`, `true`, `false`, `basename`, `dirname`, `realpath`, `file`, `stat`, `du`, `diff`, `comm`, `xargs`, `tee`, `md5sum`, `sha256sum`
- **Blocks dangerous patterns**: command substitution, backticks, `eval`, `exec`, nested shells, write redirection, interpreters (`python`, `node`, `perl`, `ruby`)
- **Restricts paths** to `/snapshot` — no traversal outside the volume
- Enforces a 15s timeout and 5MB output cap per command

The web service reaches it over the Railway private network (`SANDBOX_URL`, default `http://sandbox.railway.internal:3200`).

### 3. Data layer

| Store | Railway primitive | Purpose |
|---|---|---|
| PostgreSQL | Railway Postgres plugin | Users, chats, messages, sources, agent config |
| Redis | Railway Redis + volume | Sandbox sessions, rate limits |
| Snapshot | Railway Volume | The actual cloned knowledge base that the sandbox searches |

## Security model

The sandbox service is the security boundary. The web service sends commands, but:

1. The SDK's `validateShellCommand` rejects disallowed commands/paths before they leave the client.
2. The web service re-validates every command before forwarding.
3. The sandbox re-validates and executes with a 15s timeout.
4. Only the sandbox service mounts the volume — the web service has no filesystem access to the snapshot, so a compromised API can't read arbitrary files.

This is defense-in-depth: even if one validation layer is bypassed, the next catches it.

## Sync flow

```
User adds source (owner/repo)  →  POST /api/sources
User clicks "Sync"             →  POST /api/sync
                                   │
                                   ├─ web → sandbox /sync-run:
                                   │        git clone --depth 1 --branch <branch>
                                   │          https://github.com/<owner>/<repo>.git
                                   │          /snapshot/gh/<owner>_<repo>
                                   │        find ... -delete  (docs-only filter)
                                   │        find ... -type d -empty -delete
                                   └─ sandbox volume updated → agent can grep it
```

## Chat flow

```
User message → POST /api/chats
              ├─ rate limit check (Redis or in-memory, 20 req/min per user)
              ├─ router model classifies complexity (4/8/15/25 steps)
              ├─ main model instantiated (provider from env keys)
              ├─ generateText with bash tools:
              │    ├─ abortSignal: req.signal (stops on disconnect)
              │    ├─ bash / bash_batch tool → POST /api/sandbox/shell
              │    │                          → sandbox grep/find/cat
              │    ├─ onStepEnd: log per-step token usage
              │    └─ compose answer + citations
              └─ response returned with file references + total usage
```

## Why not a vector DB?

Vector search answers "what's semantically near this chunk?" — which silently fails on structured questions ("how do I set the rate limit to 60 req/min?") because the right answer lives in one specific file that scored 0.79 against a wrong-but-similar chunk that scored 0.82.

Filesystem search answers the question directly: the agent `grep`s for the exact terms, reads the exact file, and cites it. When it's wrong, you see *why* in seconds. No chunk boundary tuning, no embedding model drift, no similarity thresholds in the dark.
