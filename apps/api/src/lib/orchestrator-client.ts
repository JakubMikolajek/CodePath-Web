import { env } from '../config/env'

const ORCHESTRATOR_TIMEOUT_MS = 60_000

export interface OrchestratorChatRpcInput {
  prompt: string
  repoId: number
}

export interface OrchestratorEmbeddingSegment {
  comment?: string
  content: string
  decorators?: string[]
  endLine?: number
  fileExt?: string
  fileId: number
  filePath?: string
  jsDoc?: string
  language?: string
  params?: string[]
  returnType?: string
  startLine?: number
  symbolKind: string
  symbolName?: string
}

export interface OrchestratorEmbeddingJobInput {
  repoId: number
  segments: OrchestratorEmbeddingSegment[]
}

export class OrchestratorClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'OrchestratorClientError'
  }
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Orchestrator request timed out')), ORCHESTRATOR_TIMEOUT_MS)
  if (typeof timeout === 'object' && timeout && 'unref' in timeout && typeof timeout.unref === 'function') {
    timeout.unref()
  }

  try {
    const response = await fetch(new URL(path, env.orchestratorUrl), {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    })

    const rawBody = await response.text()

    if (!response.ok) {
      throw new OrchestratorClientError(
        `Orchestrator request failed with status ${response.status}${rawBody ? `: ${rawBody}` : ''}`
      )
    }

    if (!rawBody) {
      return undefined as TResponse
    }

    try {
      return JSON.parse(rawBody) as TResponse
    } catch (cause) {
      throw new OrchestratorClientError('Orchestrator response body was not valid JSON', cause)
    }
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new OrchestratorClientError('Orchestrator request timed out', cause)
    }

    if (cause instanceof OrchestratorClientError) {
      throw cause
    }

    throw new OrchestratorClientError('Orchestrator request failed', cause)
  } finally {
    clearTimeout(timeout)
  }
}

export async function requestChatRpc(input: OrchestratorChatRpcInput): Promise<string> {
  const response = await postJson<{ response?: unknown }>('/v1/chat/rpc', input)

  if (typeof response?.response !== 'string') {
    throw new OrchestratorClientError('Orchestrator chat response payload was invalid')
  }

  return response.response
}

export async function enqueueDocsJob(input: { repoId: number }): Promise<void> {
  await postJson<void>('/v1/jobs/docs', input)
}

export async function enqueueEmbeddingJob(input: OrchestratorEmbeddingJobInput): Promise<void> {
  await postJson<void>('/v1/jobs/embedding', input)
}
