import { SavoirClient } from './client'
import type { SavoirConfig } from './types'
import { createBashBatchTool, createBashTool } from './tools/shell'

export { SavoirClient, SavoirError, NetworkError } from './client'
export type * from './types'
export { validateShellCommand, ALLOWED_BASH_COMMANDS, BLOCKED_SHELL_PATTERNS } from './shell-policy'
export { createBashTool, createBashBatchTool } from './tools/shell'

/** High-level client with AI SDK tools attached. */
export function createSavoir(config: SavoirConfig) {
  const client = new SavoirClient(config)
  return {
    ...client,
    tools: {
      bash: createBashTool(client),
      bash_batch: createBashBatchTool(client),
    },
  }
}
