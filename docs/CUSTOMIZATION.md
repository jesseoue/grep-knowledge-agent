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

The complexity router classifies questions and selects a model *tier*. The tier → concrete-model mapping lives in `packages/agent/src/models.ts` — update it there and every consumer picks it up:

```ts
export const MODEL_TIERS = {
  cheap: {
    anthropic: 'claude-haiku-4-5',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
  },
  balanced: {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
  powerful: {
    anthropic: 'claude-opus-4-8',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
} as const
```

The router model (used to classify questions) uses the `cheap` tier. The main model is selected by question complexity:

| Complexity | Tier | Max steps |
|---|---|---|
| trivial | cheap | 4 |
| simple | cheap | 8 |
| moderate | balanced | 15 |
| complex | powerful | 25 |

The concrete provider is chosen at runtime from the API keys you configured (`ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` priority). To change which provider handles which tier, edit `MODEL_TIERS` and `PROVIDER_PRIORITY` in `packages/agent/src/models.ts`.

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
