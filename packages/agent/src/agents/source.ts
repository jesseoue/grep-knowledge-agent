import { stepCountIs, ToolLoopAgent, type StepResult, type ToolSet, type UIMessage } from 'ai'
import { routeQuestion } from '../router/route-question'
import { buildChatSystemPrompt } from '../prompts/chat'
import type { AgentConfigData, AgentCallOptions, AgentExecutionContext, RoutingResult } from '../types'

export interface SourceAgentOptions {
  tools: Record<string, unknown>
  getAgentConfig: () => Promise<AgentConfigData>
  messages: UIMessage[]
  /** AI SDK language model (already constructed from provider keys) */
  routerModel: Parameters<typeof routeQuestion>[1]
  resolveModel: (routed: RoutingResult) => Parameters<typeof routeQuestion>[1]
  requestId?: string
  defaultModel?: Parameters<typeof routeQuestion>[1]
  onRouted?: (result: RoutingResult) => void
  onStepFinish?: (stepResult: unknown) => void
  onFinish?: (result: unknown) => void
}

export function createSourceAgent({
  tools,
  getAgentConfig,
  messages,
  routerModel,
  resolveModel,
  requestId,
  defaultModel,
  onRouted,
  onStepFinish,
  onFinish,
}: SourceAgentOptions) {
  const id = requestId ?? crypto.randomUUID().slice(0, 8)
  let maxSteps = 15

  const fallbackModel = defaultModel ?? resolveModel({
    complexity: 'moderate',
    maxSteps: 15,
    model: 'sonnet',
    reasoning: 'default',
  })

  return new ToolLoopAgent({
    model: fallbackModel,
    prepareCall: async ({ options, ...settings }) => {
      const modelOverride = (options as AgentCallOptions | undefined)?.model
      const customContext = (options as AgentCallOptions | undefined)?.context

      const [routerConfig, agentConfig] = await Promise.all([
        routeQuestion(messages, routerModel),
        getAgentConfig(),
      ])

      const effectiveMaxSteps = Math.round(routerConfig.maxSteps * (agentConfig.maxStepsMultiplier ?? 1))
      const effectiveModel = modelOverride
        ? resolveModel({ ...routerConfig, model: modelOverride })
        : resolveModel(routerConfig)

      maxSteps = effectiveMaxSteps
      onRouted?.({ ...routerConfig, maxSteps: effectiveMaxSteps, model: (routerConfig as RoutingResult).model })

      const executionContext: AgentExecutionContext = {
        mode: 'chat',
        effectiveModel: (routerConfig as RoutingResult).model,
        maxSteps: effectiveMaxSteps,
        routerConfig: routerConfig as RoutingResult,
        agentConfig,
        customContext,
      }

      return {
        ...settings,
        model: effectiveModel,
        instructions: buildChatSystemPrompt(agentConfig),
        tools: { ...tools },
        stopWhen: stepCountIs(effectiveMaxSteps),
        experimental_context: executionContext,
      }
    },
    onStepFinish,
    onFinish,
  })
}
