import { describe, expect, it } from 'vitest'

import chatReducer, {
  appendStreamingAssistantText,
  getSessionDetails,
  sendMessage
} from './chatSlice'

const sendArgs = {
  question: 'How does this work?',
  repoId: 7,
  sessionId: 'session-1'
}

describe('chatSlice streaming state', () => {
  it('keeps streamed text through done and clears it atomically with persisted history', () => {
    const pendingState = chatReducer(undefined, sendMessage.pending('send-1', sendArgs))
    const chunkState = chatReducer(pendingState, appendStreamingAssistantText('Live answer'))
    const doneState = chatReducer(chunkState, sendMessage.fulfilled(undefined, 'send-1', sendArgs))
    const refetchingState = chatReducer(doneState, getSessionDetails.pending('details-1', {
      repoId: 7,
      sessionId: 'session-1'
    }))
    const persistedState = chatReducer(refetchingState, getSessionDetails.fulfilled([{
      content: 'Live answer',
      id: 'message-1',
      role: 'assistant'
    }], 'details-1', {
      repoId: 7,
      sessionId: 'session-1'
    }))

    expect(doneState.streamingAssistantText).toBe('Live answer')
    expect(refetchingState.streamingAssistantText).toBe('Live answer')
    expect(persistedState.streamingAssistantText).toBeNull()
    expect(persistedState.sessionDetails).toEqual([{
      content: 'Live answer',
      id: 'message-1',
      role: 'assistant'
    }])
  })

  it('surfaces stream errors and preserves a visible partial answer', () => {
    const pendingState = chatReducer(undefined, sendMessage.pending('send-2', sendArgs))
    const chunkState = chatReducer(pendingState, appendStreamingAssistantText('Partial answer'))
    const errorState = chatReducer(
      chunkState,
      sendMessage.rejected(new Error('failed'), 'send-2', sendArgs, 'Chat response failed (CHAT_STREAM_IDLE_TIMEOUT): stream timed out')
    )

    expect(errorState.isStreaming).toBe(false)
    expect(errorState.streamingAssistantText).toBe('Partial answer')
    expect(errorState.streamError).toBe('Chat response failed (CHAT_STREAM_IDLE_TIMEOUT): stream timed out')
  })
})
