import { Inject, Injectable } from '@nestjs/common'
import type { IngestJobRequestV2 } from '@workspace/codepath-common/ingest'
import type { RepoDocsJobRequest } from '@workspace/codepath-common/repository'
import axios, { type AxiosInstance } from 'axios'

import { env } from '../../../config/env'
import { HTTP_CLIENT } from '../../http-client/http-client.tokens'
import { assertValidIngestJobRequestFromWeb } from './ingest-message.validator'

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

function isTimeoutError(cause: unknown): boolean {
  if (axios.isAxiosError(cause) && (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT')) return true

  if (!cause || typeof cause !== 'object') return false

  const code = Reflect.get(cause, 'code')
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT'
}

@Injectable()
export class OrchestratorClient {
  constructor(
    @Inject(HTTP_CLIENT) private readonly httpClient: AxiosInstance
  ) {}

  async enqueueDocsJob(input: RepoDocsJobRequest): Promise<void> {
    await this.postJson<void>('/v1/jobs/docs', input)
  }

  async enqueueIngestJob(input: IngestJobRequestV2): Promise<void> {
    try {
      assertValidIngestJobRequestFromWeb(input)
    } catch (cause) {
      throw new OrchestratorClientError('Ingest job payload failed producer-side contract validation', cause)
    }

    await this.postJson<void>('/v1/jobs/ingest', input)
  }

  async requestChatRpc(input: OrchestratorChatRpcInput): Promise<string> {
    const response = await this.postJson<{ response?: unknown }>('/v1/chat/rpc', input)

    if (typeof response?.response !== 'string') throw new OrchestratorClientError('Orchestrator chat response payload was invalid')

    return response.response
  }

  private async postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
    try {
      const response = await this.httpClient.request<string>({
        data: body,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        method: 'POST',
        responseType: 'text',
        timeout: env.orchestratorTimeoutMs,
        transformResponse: [data => data],
        url: new URL(path, env.orchestratorUrl).toString(),
        validateStatus: () => true
      })

      const rawBody = response.data ?? ''

      if (response.status < 200 || response.status >= 300) throw new OrchestratorClientError(`Orchestrator request failed with status ${response.status}${rawBody ? `: ${rawBody}` : ''}`)

      if (!rawBody) return undefined as TResponse

      try {
        return JSON.parse(rawBody) as TResponse
      } catch (cause) {
        throw new OrchestratorClientError('Orchestrator response body was not valid JSON', cause)
      }
    } catch (cause) {
      if (cause instanceof OrchestratorClientError) throw cause

      if (isTimeoutError(cause)) throw new OrchestratorClientError('Orchestrator request timed out', cause)

      throw new OrchestratorClientError('Orchestrator request failed', cause)
    }
  }
}
