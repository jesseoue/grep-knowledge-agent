# Environment Variables

All configuration is done via environment variables. On Railway these are set per-service in the dashboard, or automatically via template references.

## Required

| Variable | Example | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` | Session signing secret. **Never commit a real value.** On Railway, use `${{secret()}}` to auto-generate. If unset, the app generates an ephemeral runtime secret (sessions reset on redeploy). |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string (provided by Railway Postgres plugin). |
| `REDIS_URL` | `redis://default:...` | Redis connection string (provided by Railway Redis plugin). |

> At least **one** AI provider key is required:

| Variable | Provider | Enables models |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter (recommended) | `openai/gpt-5.4-mini`, `openai/gpt-5.4`, `openai/gpt-5.4-pro` — *one key, every vendor* |
| `OPENAI_API_KEY` | OpenAI | `gpt-4o`, `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Anthropic | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini | `gemini-2.5-flash` |

The complexity router is **provider-agnostic**: it uses whichever provider you
configured. Set any *one* key and the whole template works — it picks the right
model per question difficulty from that provider.

> **OpenRouter is recommended.** A single OpenRouter key (`sk-or-...`) unlocks
> every model from every vendor (Anthropic, OpenAI, Google, DeepSeek, Qwen, …)
> through one OpenAI-compatible endpoint. If only an OpenRouter key is set, the
> app uses OpenRouter models exclusively — no need to create three separate
> vendor keys.


## Optional

| Variable | Default | Description |
|---|---|---|
| `SNAPSHOT_REPO` | — | Default `owner/repo` to seed on first sync. |
| `SNAPSHOT_BRANCH` | `main` | Branch to clone. |
| `SANDBOX_URL` | `http://sandbox.railway.internal:3200` | Private hostname of the sandbox service. |
| `PUBLIC_SITE_URL` | — | Your public app URL (used for auth trusted origins). |
| `MAX_TOKENS_PER_USER` | `0` (unlimited) | Credit quota — max tokens a user may consume (all-time). Set to cap free usage and bill against credits. |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID. **Optional** — enables "Continue with GitHub" on the login page. Email/password works without it. |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret. Optional, paired with the client ID. |

---

## Getting your AI provider API keys

You need at least one. The agent uses a **complexity router** — a cheap model classifies each question, then routes to the right model for the job. You can mix providers (e.g. OpenRouter for everything, or OpenAI for the router + Anthropic for complex questions).

### OpenRouter (recommended)

1. Go to **<https://openrouter.ai/settings/keys>**
2. Sign in or create an account.
3. Click **Create Key**, give it a name, and copy it (starts with `sk-or-...`).
4. Set it as `OPENROUTER_API_KEY`.
5. **Billing**: Add credits at <https://openrouter.ai/settings/credits>. OpenRouter bills per-model; you pay only for what you use.

> **Which model?** With only an OpenRouter key set, the router uses `openai/gpt-5.4-mini` for trivial/simple questions, `openai/gpt-5.4` for moderate, and `openai/gpt-5.4-pro` for complex. Because OpenRouter exposes every vendor's models through one endpoint, you can override any tier to any model slug (e.g. `anthropic/claude-sonnet-4.6`, `deepseek/deepseek-v4-pro`) by editing `MODEL_TIERS` in `packages/agent/src/models.ts`. See <https://openrouter.ai/models> for the full catalog.

### OpenAI

1. Go to **<https://platform.openai.com/api-keys>**
2. Sign in or create an account.
3. Click **Create new secret key**.
4. Copy the key (starts with `sk-...`) and set it as `OPENAI_API_KEY`.
5. **Billing**: OpenAI requires a credit card on file. Add one at <https://platform.openai.com/settings/billing>. The models this template uses (`gpt-4o-mini`) are very cheap — a few dollars covers thousands of queries.

> **Which model?** The router uses `gpt-4o-mini` for trivial/simple questions and `gpt-4o` for moderate ones. See <https://platform.openai.com/docs/models> for the full list.

### Anthropic

1. Go to **<https://console.anthropic.com/settings/keys>**
2. Sign in or create an account.
3. Click **Create Key**, give it a name, and copy it (starts with `sk-ant-...`).
4. Set it as `ANTHROPIC_API_KEY`.
5. **Billing**: Add credits at <https://console.anthropic.com/settings/billing>. Anthropic uses pre-paid credits (no automatic billing).

> **Which model?** The router uses `claude-haiku-4-5` to classify questions, then routes to `claude-sonnet-4-6` (moderate) or `claude-opus-4-8` (complex). See <https://platform.claude.com/docs/en/about-claude/models/overview> for details.

### Google Gemini

1. Go to **<https://aistudio.google.com/apikey>**
2. Sign in with a Google account.
3. Click **Create API key** → choose a project (or create one).
4. Copy the key (starts with `AIza...`) and set it as `GOOGLE_GENERATIVE_AI_API_KEY`.
5. **Billing**: Google AI Studio has a **free tier** (15 RPM, 1500 requests/day) that's enough to try the template. For production, enable billing at <https://aistudio.google.com/billing>.

> **Which model?** The template uses `gemini-2.5-flash` for every tier when Gemini is your only provider. See <https://ai.google.dev/gemini-api/docs/models> for the full list.

---

## Setting up GitHub OAuth

The template uses GitHub OAuth for authentication (Better Auth). You need a GitHub OAuth app:

1. Go to GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Direct link: <https://github.com/settings/developers>
2. Fill in:
   - **Application name**: `Grep Knowledge Agent`
   - **Homepage URL**: `https://<your-app>.up.railway.app`
   - **Authorization callback URL**: `https://<your-app>.up.railway.app/api/auth/callback/github`
3. Click **Register application**.
4. Copy the **Client ID** → set as `GITHUB_CLIENT_ID`.
5. Click **Generate a new client secret** → copy it → set as `GITHUB_CLIENT_SECRET`.

> For local development, use `http://localhost:3000` as the Homepage and Callback URL.

> **Trusted origins are auto-detected.** The app automatically trusts your Railway public domain (`RAILWAY_PUBLIC_DOMAIN`) and static URL (`RAILWAY_STATIC_URL`), plus `http://localhost:3000`. You only need to set `PUBLIC_SITE_URL` if you use a custom domain that isn't auto-detected.

---

## Railway variable reference syntax

In Railway's config-as-code (`railway.json` / `railway.toml`) or template definitions, you can use:

```
${{secret()}}          # auto-generate a random secret (for BETTER_AUTH_SECRET)
${{openai.apiKey}}     # reference a shared secret group
${{postgres.DATABASE_URL}}  # reference the Postgres plugin's connection string
${{redis.REDIS_URL}}   # reference the Redis plugin's connection string
```

See <https://docs.railway.com/config-as-code/reference> for the full syntax.
