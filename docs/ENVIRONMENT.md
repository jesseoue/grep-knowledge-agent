# Environment Variables

All configuration is done via environment variables. On Railway these are set per-service in the dashboard, or automatically via template references.

## Required

| Variable | Example | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` | Session signing secret. **Never commit a real value.** |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string (provided by Railway Postgres). |
| `REDIS_URL` | `redis://default:...` | Redis connection string (provided by Railway Redis). |
| `GITHUB_CLIENT_ID` | `Iv1.abc123` | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | `abc123...` | GitHub OAuth app client secret. |

> At least **one** AI provider key is required:

| Variable | Provider | Notes |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | Enables `gpt-4o`, `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Anthropic | Enables `claude-sonnet`, `claude-opus` |
| `GOOGLE_API_KEY` | Google Gemini | Enables `gemini-flash`, `gemini-pro` |

## Optional

| Variable | Default | Description |
|---|---|---|
| `SNAPSHOT_REPO` | — | Default `owner/repo` to seed on first sync. |
| `SNAPSHOT_BRANCH` | `main` | Branch to clone. |
| `SANDBOX_URL` | `http://sandbox:3000` | Private hostname of the sandbox service. |
| `PUBLIC_SITE_URL` | — | Your public app URL (used for auth trusted origins). |

## Setting up GitHub OAuth

1. Go to GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Application name: `Grep Knowledge Agent`
3. Homepage URL: `https://<your-app>.up.railway.app`
4. Authorization callback URL: `https://<your-app>.up.railway.app/api/auth/callback/github`
5. Copy the Client ID and Client Secret into your Railway variables.
