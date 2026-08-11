export interface ShellResponse {
  sessionId: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellBatchItem {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellBatchResponse {
  sessionId: string
  results: ShellBatchItem[]
}

export interface SavoirConfig {
  /** Base URL of the web app API, e.g. https://yourapp.up.railway.app */
  apiUrl: string
  /** Optional API key for SDK access */
  apiKey?: string
  headers?: Record<string, string>
  sessionId?: string
}

export interface SourcesResponse {
  total: number
  github: { count: number, sources: unknown[] }
  youtube: { count: number, sources: unknown[] }
  file: { count: number, sources: unknown[] }
  snapshotRepo: string | null
}

export interface SyncResponse {
  success: boolean
  summary: { total: number, success: number, failed: number, files: number }
  results: unknown[]
}
