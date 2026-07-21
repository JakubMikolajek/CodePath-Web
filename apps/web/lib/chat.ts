import type { ChatSession, SessionDetail } from '@workspace/codepath-common/chat'

import { apiClient } from '@/lib/api/api'

export type ChatStreamEvent
  = | { code: string; message: string; type: 'error' }
  | { delta: string; done: false; type: 'chunk' }
  | { delta: string; done: true; type: 'done' }

export async function createSession (repoId: number) {
  return await apiClient.get(`/chat/${repoId}/createSession`)
}

export async function* sendMessage (repoId: number, body: object): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`/api/backend/chat/${repoId}`, {
    body: JSON.stringify(body),
    credentials: 'include',
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json'
    }
  })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/') window.location.assign('/')

    throw new Error(`Chat request failed with status ${response.status}`)
  }

  if (!response.body) throw new Error('Chat response stream was unavailable')

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

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

    buffer += decoder.decode()

    if (buffer.trim()) throw new Error('Chat response stream ended with an incomplete event')

    throw new Error('Chat response stream ended before a terminal event')
  } finally {
    try {
      await reader.cancel()
    } catch {
      // The server may have already closed the terminal SSE response.
    }
    reader.releaseLock()
  }
}

export async function getChatSessions (repoId: number) {
  return await apiClient.get<ChatSession[]>(`/chat/${repoId}`)
}

export async function getSessionDetails (repoId: number, sessionId: string) {
  return await apiClient.get<SessionDetail[]>(`/chat/${repoId}/${sessionId}`)
}

function parseChatStreamFrame(frame: string): ChatStreamEvent {
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

  if (!eventType || dataLines.length === 0) throw new Error('Chat response contained an invalid SSE event')

  let payload: unknown

  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    throw new Error('Chat response contained invalid JSON')
  }

  if (!isRecord(payload)) throw new Error('Chat response contained an invalid event payload')

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

  throw new Error('Chat response contained an invalid event payload')
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
