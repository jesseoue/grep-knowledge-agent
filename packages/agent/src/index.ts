export { createSourceAgent } from './agents/source'
export type { SourceAgentOptions } from './agents/source'
export { routeQuestion } from './router/route-question'
export { agentConfigSchema, getDefaultConfig } from './router/schema'
export type { AgentConfig } from './router/schema'
export { buildChatSystemPrompt, ROUTER_SYSTEM_PROMPT } from './prompts'
export {
  MODEL_ALIASES,
  ROUTER_MODEL_ALIAS,
  DEFAULT_MODEL_ALIAS,
  ROUTER_MODEL_CHOICES,
  resolveModelId,
} from './models'
export type { ModelAlias } from './models'
export type { AgentConfigData, RoutingResult, AgentCallOptions, AgentExecutionContext } from './types'
