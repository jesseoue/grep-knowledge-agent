# Customization

## Adding a source

In **Settings → Add GitHub source**:

| Field | Example | Meaning |
|---|---|---|
| Label | `Nuxt docs` | Display name in the UI |
| Repository | `nuxt/nuxt` | `owner/repo` to clone |
| Branch | `main` | Branch to sync |
| Content path | `docs/` | Subdirectory to keep (optional) |

The sync clones with `--depth 1 --single-branch`, filters to docs files (`*.md`, `*.mdx`, `*.yml`, `*.yaml`, `*.json`), and removes empty dirs. The snapshot volume stays lean.

## Agent behavior

Agent configuration lives in the `agent_config` table and is seeded via the app:

- **Response style**: `concise | detailed | technical | friendly`
- **Max steps multiplier**: scale the complexity router's step budget
- **Search instructions**: extra guidance for the agent's `grep` strategy
- **Citation format**: `inline | footnote | none`

## Model routing

The complexity router classifies questions and selects models. The model registry lives in `packages/agent/src/models.ts` — update it there and every consumer picks it up:

```ts
export const MODEL_ALIASES = {
  'gemini-flash': 'gemini-2.0-flash',
  'sonnet': 'claude-sonnet-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'haiku': 'claude-haiku-4-20250514',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
}
```

The router model (used to classify questions) defaults to `haiku` (Claude Haiku 4 — fast and cheap). The main model is selected by the router based on question complexity:

| Complexity | Model | Max steps |
|---|---|---|
| trivial | `gemini-flash` or `gpt-4o-mini` | 4 |
| simple | `gemini-flash` or `gpt-4o-mini` | 8 |
| moderate | `sonnet` or `gpt-4o` | 15 |
| complex | `opus` | 25 |

To change which provider handles which tier, edit the model aliases in `packages/agent/src/models.ts`.

## Using the SDK outside the app

```ts
import { createSavoir } from '@grep/sdk'

const client = createSavoir({
  apiUrl: 'https://your-app.up.railway.app',
  headers: { cookie: '...' }, // or apiKey for SDK tokens
})

const result = await client.bash('grep -rli "rate limit" docs/')
console.log(result.stdout)

// AI SDK tools (same as the built-in chat):
// client.tools.bash, client.tools.bash_batch
```

## Extending the sandbox command allowlist

Edit `packages/sdk/src/shell-policy.ts` → `ALLOWED_BASH_COMMANDS`. Remember: the web service and sandbox both validate, so update the shared SDK package (imported by both). The sandbox service has its own vendored copy at `sandbox-service/shell-policy.ts` — update both to keep them in sync.
