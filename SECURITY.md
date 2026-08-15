# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use the repository's [private vulnerability reporting form](https://github.com/jesseoue/grep-knowledge-agent/security/advisories/new) and include:

- the affected route, component, or configuration;
- reproduction steps and the expected impact;
- any relevant logs with credentials and personal data removed.

You should receive an acknowledgement within seven days. Please allow time for a fix and coordinated disclosure before publishing details.

## Deployment boundary

Grep Knowledge Agent is a self-hosted template. Operators remain responsible for Railway access controls, private networking, provider keys, synced repository permissions, updates, and backups. Keep the sandbox service private and configure the same generated `SANDBOX_SECRET` on the web and sandbox services.
