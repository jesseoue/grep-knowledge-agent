import type {
  ShellBatchResponse,
  ShellResponse,
  SourcesResponse,
  SyncResponse,
  SavoirConfig,
} from './types'

export class SavoirError extends Error {
  statusCode: number
  error?: unknown

  constructor(opts: { statusCode: number, message: string, error?: unknown }) {
    super(opts.message)
    this.name = 'SavoirError'
    this.statusCode = opts.statusCode
    this.error = opts.error
  }
}

export class NetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'NetworkError'
  }
}

/** Low-level HTTP client for the Grep Knowledge Agent API. */
export class SavoirClient {
  private readonly apiUrl: string
  private readonly apiKey?: string
  private readonly extraHeaders: Record<string, string>
  private sessionId?: string

  constructor(config: SavoirConfig) {
    if (!config.apiUrl) {
      throw new Error(
        'Missing apiUrl in Savoir configuration. ' +
        'Set apiUrl to the base URL of your deployed app.',
      )
    }

    this.apiUrl = config.apiUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.extraHeaders = config.headers ?? {}
    this.sessionId = config.sessionId
  }

  getSessionId(): string | undefined {
    return this.sessionId
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.apiUrl}${path}`

    const headers: Record<string, string> = { ...this.extraHeaders }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, { method: 'GET', headers })
      const data = await response.json()

      if (!response.ok) {
        throw new SavoirError({
          statusCode: response.status,
          message: data.message || 'Unknown error',
          error: data.error,
        })
      }

      return data as T
    } catch (error) {
      if (error instanceof SavoirError) {
        throw error
      }
      throw new NetworkError(
        `Failed to connect to API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  private async post<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.apiUrl}${path}`

    const headers: Record<string, string> = {
      ...this.extraHeaders,
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, sessionId: this.sessionId }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new SavoirError({
          statusCode: response.status,
          message: data.message || 'Unknown error',
          error: data.error,
        })
      }

      if (data.sessionId) {
        this.sessionId = data.sessionId
      }

      return data as T
    } catch (error) {
      if (error instanceof SavoirError) {
        throw error
      }
      throw new NetworkError(
        `Failed to connect to API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async bash(command: string): Promise<ShellResponse> {
    return await this.post<ShellResponse>('/api/sandbox/shell', { command })
  }

  async bashBatch(commands: string[]): Promise<ShellBatchResponse> {
    return await this.post<ShellBatchResponse>('/api/sandbox/shell', { commands })
  }

  async getSources(): Promise<SourcesResponse> {
    return await this.get<SourcesResponse>('/api/sources')
  }

  async sync(): Promise<SyncResponse> {
    return await this.post<SyncResponse>('/api/sync')
  }
}
