import type { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

import { Inject, Injectable } from '@nestjs/common'
import type { IngestJobRequestV2 } from '@workspace/codepath-common/ingest'
import type { RepoDocsJobRequest, RepoEvaluationJobRequest } from '@workspace/codepath-common/repository'
import axios, { type AxiosInstance } from 'axios'

import { env } from '../../../config/env'
import { HTTP_CLIENT } from '../../http-client/http-client.tokens'
import { assertValidIngestJobRequestFromWeb } from './ingest-message.validator'

export interface OrchestratorChatRpcInput {
  prompt: string
  repoId: number
}

export type OrchestratorChatStreamEvent
  = | { code: string; message: string; type: 'error' }
  | { delta: string; done: false; type: 'chunk' }
  | { delta: string; done: true; type: 'done' }

export class OrchestratorClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'OrchestratorClientError'
  }
}

function isTimeoutError(cause: unknown): boolean {
  if (axios.isAxiosError(cause) && (cause.code === 'ECONNABORTED' || cause.code === 'ETIMEDOUT')) return true

  if (!cause || typeof cause !== 'object') return false

  const code = 'code' in cause ? cause.code : undefined
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT'
}

function parseChatStreamFrame(frame: string): OrchestratorChatStreamEvent {
  let eventType = ''
  const dataLines: string[] = []

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    const rawValue = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1)
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') eventType = value
    if (field === 'data') dataLines.push(value)
  }

  if (!eventType || dataLines.length === 0) throw new OrchestratorClientError('Orchestrator chat stream frame was invalid')

  let payload: unknown

  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch (cause) {
    throw new OrchestratorClientError('Orchestrator chat stream data was not valid JSON', cause)
  }

  if (!isRecord(payload)) throw new OrchestratorClientError('Orchestrator chat stream payload was invalid')

  if (eventType === 'chunk') {
    const { delta, done } = payload

    if (typeof delta === 'string' && done === false) return { delta, done, type: 'chunk' }
  }

  if (eventType === 'done') {
    const { delta, done } = payload

    if (typeof delta === 'string' && done === true) return { delta, done, type: 'done' }
  }

  if (eventType === 'error') {
    const { code, message } = payload

    if (typeof code === 'string' && typeof message === 'string') return { code, message, type: 'error' }
  }

  throw new OrchestratorClientError('Orchestrator chat stream payload was invalid')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function takeCompleteFrame(buffer: string): null | { frame: string; rest: string } {
  const separator = /\r?\n\r?\n/.exec(buffer)

  if (!separator || separator.index === undefined) return null

  return {
    frame: buffer.slice(0, separator.index),
    rest: buffer.slice(separator.index + separator[0].length)
  }
}

@Injectable()
export class OrchestratorClient {
  constructor(
    @Inject(HTTP_CLIENT) private readonly httpClient: AxiosInstance
  ) {}

  async enqueueDocsJob(input: RepoDocsJobRequest): Promise<void> {
    await this.postJson<void>('/v1/jobs/docs', input)
  }

  async enqueueEvaluationJob(input: RepoEvaluationJobRequest): Promise<void> {
    await this.postJson<void>('/v1/jobs/evaluation', input)
  }

  async enqueueIngestJob(input: IngestJobRequestV2): Promise<void> {
    try {
      assertValidIngestJobRequestFromWeb(input)
    } catch (cause) {
      throw new OrchestratorClientError('Ingest job payload failed producer-side contract validation', cause)
    }

    await this.postJson<void>('/v1/jobs/ingest', input)
  }

  async *streamChatRpc(input: OrchestratorChatRpcInput): AsyncGenerator<OrchestratorChatStreamEvent> {
    let stream: Readable | undefined

    try {
      const response = await this.httpClient.request<Readable>({
        data: input,
        headers: {
          accept: 'text/event-stream',
          'content-type': 'application/json'
        },
        method: 'POST',
        responseType: 'stream',
        timeout: env.orchestratorTimeoutMs,
        url: new URL('/v1/chat/rpc', env.orchestratorUrl).toString(),
        validateStatus: () => true
      })

      stream = response.data

      if (response.status < 200 || response.status >= 300) {
        throw new OrchestratorClientError(`Orchestrator chat stream request failed with status ${response.status}`)
      }

      const decoder = new StringDecoder('utf8')
      let buffer = ''

      for await (const chunk of stream) {
        buffer += typeof chunk === 'string' ? chunk : decoder.write(Buffer.from(chunk))

        let completeFrame = takeCompleteFrame(buffer)

        while (completeFrame) {
          buffer = completeFrame.rest

          if (completeFrame.frame.trim()) {
            const event = parseChatStreamFrame(completeFrame.frame)
            yield event

            if (event.type !== 'chunk') return
          }

          completeFrame = takeCompleteFrame(buffer)
        }
      }

      buffer += decoder.end()

      if (buffer.trim()) throw new OrchestratorClientError('Orchestrator chat stream ended with an incomplete frame')

      throw new OrchestratorClientError('Orchestrator chat stream ended without a terminal event')
    } catch (cause) {
      if (cause instanceof OrchestratorClientError) throw cause

      if (isTimeoutError(cause)) throw new OrchestratorClientError('Orchestrator request timed out', cause)

      throw new OrchestratorClientError('Orchestrator chat stream request failed', cause)
    } finally {
      if (stream && !stream.destroyed) stream.destroy()
    }
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
