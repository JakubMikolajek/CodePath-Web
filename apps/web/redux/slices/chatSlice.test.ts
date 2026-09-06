import { describe, expect, it } from 'vitest'

import chatReducer, {
  appendStreamingAssistantText,
  clearCompletedChatStream,
  sendMessage
} from './chatSlice'

const sendArgs = {
  question: 'How does this work?',
  repoId: 7,
  sessionId: 'session-1'
}

describe('chatSlice streaming state', () => {
  it('keeps streamed text through done and clears it after persisted history loads', () => {
    const pendingState = chatReducer(undefined, sendMessage.pending('send-1', sendArgs))
    const chunkState = chatReducer(pendingState, appendStreamingAssistantText('Live answer'))
    const doneState = chatReducer(chunkState, sendMessage.fulfilled(undefined, 'send-1', sendArgs))
    const persistedState = chatReducer(doneState, clearCompletedChatStream())

    expect(doneState.streamingAssistantText).toBe('Live answer')
    expect(persistedState.streamingAssistantText).toBeNull()
    expect(persistedState.streamCompleted).toBe(false)
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
