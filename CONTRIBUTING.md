# Contributing

Thanks for your interest in improving the Grep Knowledge Agent! This is an open-source template — forks, fixes, and features are all welcome.

## Getting started

```bash
git clone https://github.com/jesseoue/grep-knowledge-agent.git
cd grep-knowledge-agent
bun install
cp apps/web/.env.example apps/web/.env  # fill in at least one AI key
bun run db:push
bun run dev
```

## Project structure

```
apps/web          — Nuxt 4 + Nitro (chat UI, auth, REST API, agent loop)
packages/agent    — AI SDK agent: complexity router, prompts, model registry
packages/sdk      — typed client + bash/bash_batch AI SDK tools
sandbox-service   — gVisor sandbox: read-only grep/find/cat over snapshot volume
```

## Making changes

1. Create a branch: `git checkout -b fix/my-fix`
2. Make your changes. Keep code DRY — model aliases live in `packages/agent/src/models.ts`, shell policy in `packages/sdk/src/shell-policy.ts`.
3. Verify: `bun run typecheck` and `bun run build`
4. Commit with a clear message: `fix: ...` or `feat: ...`
5. Open a PR.

## Reporting issues

Use [GitHub Issues](https://github.com/jesseoue/grep-knowledge-agent/issues). Include:

- What you expected
- What happened (error message, logs)
- Your setup (which AI provider, which repo you synced)
- Steps to reproduce

## License

By contributing, you agree your contributions are licensed under the MIT license.
