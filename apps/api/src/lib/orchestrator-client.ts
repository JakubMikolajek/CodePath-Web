import type { IngestJobRequestV1 } from '@workspace/codepath-common/ingest'

import { env } from '../config/env'
import { assertValidIngestJobRequestFromWeb } from './ingest-message'

export interface OrchestratorChatRpcInput {
  prompt: string
  repoId: number
}

export class OrchestratorClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'OrchestratorClientError'
  }
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(new Error('Orchestrator request timed out')),
    env.orchestratorTimeoutMs
  )
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

export async function enqueueIngestJob(input: IngestJobRequestV1): Promise<void> {
  try {
    assertValidIngestJobRequestFromWeb(input)
  } catch (cause) {
    throw new OrchestratorClientError('Ingest job payload failed producer-side contract validation', cause)
  }

  await postJson<void>('/v1/jobs/ingest', input)
}
