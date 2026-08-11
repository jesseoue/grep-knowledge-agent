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

The complexity router classifies questions and selects models. You can remap models via the `agent_config.default_model` and by editing `apps/web/server/api/chats.post.ts`:

```ts
const modelMap = {
  'gemini-flash': () => google('gemini-1.5-flash'),
  'sonnet': () => anthropic('claude-sonnet-4-20250514'),
  'opus': () => anthropic('claude-opus-4-20250514'),
  'gpt-4o-mini': () => openai('gpt-4o-mini'),
  'gpt-4o': () => openai('gpt-4o'),
}
```

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

Edit `packages/sdk/src/shell-policy.ts` → `ALLOWED_BASH_COMMANDS`. Remember: the web service and sandbox both validate, so update the shared SDK package (imported by both).

## Uploading files

The `file` source type is designed for direct file uploads into the snapshot (e.g. meeting transcripts, PDFs-to-markdown). It's stubbed in the UI — the API shape is `POST /api/sources` with `{ type: 'file', files: [...] }`, and the sandbox writes them under `/snapshot/files/<id>/`.
