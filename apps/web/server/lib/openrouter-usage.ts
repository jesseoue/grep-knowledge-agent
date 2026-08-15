import type { ProviderMetadata } from 'ai'

interface OpenRouterUsagePayload {
  usage?: {
    cost?: unknown
  }
}

function readCost(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined
  const cost = (value as OpenRouterUsagePayload).usage?.cost
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined
}

/** Captures OpenRouter's non-standard usage.cost field for AI SDK results. */
export const openRouterMetadataExtractor = {
  async extractMetadata({ parsedBody }: { parsedBody: unknown }) {
    const cost = readCost(parsedBody)
    return cost === undefined ? undefined : { openrouter: { costUsd: cost } }
  },
  createStreamExtractor() {
    let costUsd: number | undefined
    return {
      processChunk(chunk: unknown) {
        const cost = readCost(chunk)
        if (cost !== undefined) costUsd = cost
      },
      buildMetadata() {
        return costUsd === undefined ? undefined : { openrouter: { costUsd } }
      },
    }
  },
}

export function getOpenRouterCostUsd(metadata: ProviderMetadata | undefined): number | undefined {
  const cost = metadata?.openrouter?.costUsd
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : undefined
}
