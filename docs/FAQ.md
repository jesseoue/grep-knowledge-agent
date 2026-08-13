# FAQ

## How is this different from vector RAG?

Vector RAG chunks your docs, embeds them, stores them in a vector DB, and runs approximate-nearest-neighbor (ANN) queries to find "semantically similar" chunks. This has several problems:

- **Opaque** — you can't see why a particular chunk was selected
- **Fragile** — chunk boundaries, embedding model choice, and similarity thresholds all affect quality
- **Expensive** — you pay for embedding model calls + vector DB hosting + the LLM call
- **Lossy** — the right answer might score 0.79 while a wrong-but-similar chunk scores 0.82

This agent skips all of that. It gives the LLM a filesystem and `bash`, so it:

1. `grep`s for the exact terms in your question
2. Reads the exact file(s) that match
3. Composes an answer and cites the files

No chunking, no embeddings, no vector DB. The result is deterministic, explainable, and ~75% cheaper.

## Do I need all the AI provider keys?

No. You need **at least one**. The router is **provider-agnostic** — it picks the right model for each question difficulty from whichever provider you configured:

| Tier | OpenRouter (recommended) | Anthropic | OpenAI | Gemini |
|---|---|---|---|---|
| Router / cheap | `openai/gpt-5.6-luna` | `claude-haiku-4-5` | `gpt-4o-mini` | `gemini-2.5-flash` |
| Moderate | `openai/gpt-5.6-terra` | `claude-sonnet-4-6` | `gpt-4o` | `gemini-2.5-flash` |
| Complex | `openai/gpt-5.6-sol` | `claude-opus-4-8` | `gpt-4o` | `gemini-2.5-flash` |

If you set multiple keys, **OpenRouter is preferred** (one key, every model), then Anthropic, then OpenAI, then Gemini. Any single key is enough for the whole app to work.

## Is the sandbox secure?

Yes. Three layers of validation:

1. **SDK layer** — `validateShellCommand()` in `packages/sdk/src/shell-policy.ts` rejects disallowed commands before they leave the client
2. **Web layer** — `executeInSandbox()` in `apps/web/server/lib/sandbox.ts` re-validates every command
3. **Sandbox layer** — `validateShellCommand()` in `sandbox-service/shell-policy.ts` does final validation + 15s timeout + 5MB output cap

**Allowed commands**: `find`, `ls`, `tree`, `grep`, `egrep`, `fgrep`, `cat`, `head`, `tail`, `less`, `more`, `wc`, `sort`, `uniq`, `cut`, `awk`, `sed`, `tr`, `column`, `echo`, `printf`, `test`, `[`, `true`, `false`, `basename`, `dirname`, `realpath`, `file`, `stat`, `du`, `diff`, `comm`, `xargs`, `tee`, `md5sum`, `sha256sum`

**Blocked**: command substitution (`$()`), backticks, `eval`, `exec`, nested shells, write redirection (`>`), interpreters (`python`, `node`, `perl`, `ruby`), path traversal (`../`)

Only the sandbox service mounts the snapshot volume — the web service has no filesystem access.

## Can I use private GitHub repos?

Currently the sync clones public repos via `git clone --depth 1`. To support private repos, add a GitHub token to the clone command in `apps/web/server/api/sync.post.ts`:

```ts
// Replace:
`git clone --depth 1 --branch ${branch} https://github.com/${repo}.git /snapshot/gh/${repoId}`
// With:
`git clone --depth 1 --branch ${branch} https://x-access-token:${GITHUB_TOKEN}@github.com/${repo}.git /snapshot/gh/${repoId}`
```

Set `GITHUB_TOKEN` as an environment variable on the web service.

## How do I add my own docs?

1. Sign in → **Settings**
2. **Add GitHub source** → enter `owner/repo` (e.g. `nuxt/nuxt`)
3. Set a **content path** (optional, e.g. `docs/`) to only sync a subdirectory
4. Click **Sync** — the agent clones the repo, filters to docs files, and stores them on the snapshot volume
5. Ask questions in the chat

## What file types are indexed?

The sync filters to: `*.md`, `*.mdx`, `*.yml`, `*.yaml`, `*.json`. All other files are deleted from the snapshot to keep it lean.

To change this, edit the `find -delete` command in `apps/web/server/api/sync.post.ts`.

## How does the complexity router work?

A lightweight model (the cheapest tier of your configured provider) classifies each question into one of four tiers:

| Tier | Max Steps | Model (OpenRouter / Anthropic / OpenAI / Gemini) | Example |
|---|---|---|---|
| trivial | 4 | openai/gpt-5.6-luna / claude-haiku-4-5 / gpt-4o-mini / gemini-2.5-flash | "Hello", "Thanks" |
| simple | 8 | openai/gpt-5.6-luna / claude-haiku-4-5 / gpt-4o-mini / gemini-2.5-flash | "What is X?" |
| moderate | 15 | openai/gpt-5.6-terra / claude-sonnet-4-6 / gpt-4o / gemini-2.5-flash | "Compare X and Y" |
| complex | 25 | openai/gpt-5.6-sol / claude-opus-4-8 / gpt-4o / gemini-2.5-flash | "Debug this architecture issue" |

This saves cost — trivial questions use cheap models with few steps, complex questions get the strongest model with more steps.

## How do I change the models?

Edit `packages/agent/src/models.ts`:

```ts
export const MODEL_TIERS = {
  cheap: {
    openrouter: 'openai/gpt-5.6-luna',
    anthropic: 'claude-haiku-4-5',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
  },
  balanced: {
    openrouter: 'openai/gpt-5.6-terra',
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
  powerful: {
    openrouter: 'openai/gpt-5.6-sol',
    anthropic: 'claude-opus-4-8',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
} as const
```

Update the model IDs here and every consumer (router, chat, agent) picks it up.

## How do I use the SDK outside the app?

```ts
import { createSavoir } from '@grep/sdk'

const client = createSavoir({
  apiUrl: 'https://your-app.up.railway.app',
  headers: { cookie: '...' }, // or apiKey for SDK tokens
})

// Run a search command
const result = await client.bash('grep -rli "rate limit" docs/')
console.log(result.stdout)

// AI SDK tools (same as the built-in chat):
// client.tools.bash
// client.tools.bash_batch
```

## Troubleshooting

### "No AI provider configured"

Set at least one of: `OPENROUTER_API_KEY` (recommended), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` in your Railway project variables.

### "Social provider github is missing clientId or clientSecret"

Create a GitHub OAuth app and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. See [ENVIRONMENT.md](ENVIRONMENT.md) → "Setting up GitHub OAuth".

### "Sandbox sync failed"

The sandbox service needs to be running and accessible. Check:
- `SANDBOX_URL` is set to `http://sandbox.railway.internal:3200`
- The sandbox service has a volume mounted at `/snapshot`
- The sandbox service is deployed and healthy (`GET /health`)

### "Database migration failed"

Ensure `DATABASE_URL` is set and Postgres is running. Migrations run automatically on startup via the Nitro plugin at `apps/web/server/plugins/migrate.ts`.

### Chat returns empty answers

The agent might not have any sources to search. Go to **Settings → Sync** to clone a repo into the snapshot volume. Check that the sync completed successfully.
