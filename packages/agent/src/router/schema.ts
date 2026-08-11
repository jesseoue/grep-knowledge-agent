import { z } from 'zod'

export const agentConfigSchema = z.object({
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex'])
    .describe('trivial=greeting, simple=single lookup, moderate=multi-search, complex=deep analysis'),

  maxSteps: z.number().min(1).max(30)
    .describe('Agent iterations: 4 trivial, 8 simple, 15 moderate, 25 complex'),

  model: z.enum([
    'gemini-flash',
    'sonnet',
    'opus',
    'gpt-4o-mini',
    'gpt-4o',
  ]).describe('flash for trivial/simple, sonnet/gpt-4o for moderate, opus for complex'),

  reasoning: z.string().max(200)
    .describe('Brief explanation of the classification'),
})

export type AgentConfig = z.infer<typeof agentConfigSchema>

export function getDefaultConfig(): AgentConfig {
  return {
    complexity: 'moderate',
    maxSteps: 15,
    model: 'sonnet',
    reasoning: 'Default fallback configuration',
  }
}
