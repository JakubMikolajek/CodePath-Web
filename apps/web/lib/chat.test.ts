import { afterEach, describe, expect, it, vi } from 'vitest'

import { type ChatStreamEvent, sendMessage } from './chat'

describe('sendMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses POST SSE events split across browser stream reads', async () => {
    const payload = new TextEncoder().encode(
      'event: chunk\ndata: {"delta":"Hello","done":false}\n\nevent: done\ndata: {"delta":"!","done":true}\n\n'
    )
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      payload.slice(0, 17),
      payload.slice(17, 43),
      payload.slice(43)
    ]))

    vi.stubGlobal('fetch', fetchMock)

    await expect(collectEvents(sendMessage(7, {
      question: 'Hello?',
      sessionId: 'session-1'
    }))).resolves.toEqual([
      { delta: 'Hello', done: false, type: 'chunk' },
      { delta: '!', done: true, type: 'done' }
    ])
    expect(fetchMock).toHaveBeenCalledWith('/api/backend/chat/7', expect.objectContaining({
      credentials: 'include',
      method: 'POST'
    }))
  })

  it('passes through a terminal error event', async () => {
    const payload = new TextEncoder().encode(
      'event: error\ndata: {"code":"CHAT_STREAM_IDLE_TIMEOUT","message":"stream timed out"}\n\n'
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([payload])))

    await expect(collectEvents(sendMessage(8, {
      question: 'Hello?',
      sessionId: 'session-2'
    }))).resolves.toEqual([
      { code: 'CHAT_STREAM_IDLE_TIMEOUT', message: 'stream timed out', type: 'error' }
    ])
  })

  it('rejects a stream that closes without a terminal event', async () => {
    const payload = new TextEncoder().encode(
      'event: chunk\ndata: {"delta":"partial","done":false}\n\n'
    )

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([payload])))

    await expect(collectEvents(sendMessage(9, {
      question: 'Hello?',
      sessionId: 'session-3'
    }))).rejects.toThrow('Chat response stream ended before a terminal event')
  })
})

async function collectEvents(stream: AsyncIterable<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = []

  for await (const event of stream) events.push(event)

  return events
}

function streamResponse(chunks: Array<Uint8Array<ArrayBuffer>>): Pick<Response, 'body' | 'ok' | 'status'> {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      }
    })
  }
}
