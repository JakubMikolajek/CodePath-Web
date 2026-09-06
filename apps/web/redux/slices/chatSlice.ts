import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common'

import { sendMessage as sendMessageApi } from '@/lib/chat'
import { SliceName } from '@/redux/sliceName'

interface ChatState {
  isStreaming: boolean
  streamCompleted: boolean
  streamError: Nullable<string>
  streamingAssistantText: Nullable<string>
}

const initialState: ChatState = {
  isStreaming: false,
  streamCompleted: false,
  streamError: null,
  streamingAssistantText: null
}

export const sendMessage = createAsyncThunk<void, {
  question: string
  repoId: number
  sessionId: string
}, {
  rejectValue: string
}>('chat/sendMessage', async ({ question, repoId, sessionId }, { dispatch, rejectWithValue }) => {
  try {
    for await (const event of sendMessageApi(repoId, { question, sessionId })) {
      if (event.type === 'chunk') {
        dispatch(appendStreamingAssistantText(event.delta))
        continue
      }

      if (event.type === 'done') {
        dispatch(appendStreamingAssistantText(event.delta))
        return
      }

      return rejectWithValue(`Chat response failed (${event.code}): ${event.message}`)
    }

    return rejectWithValue('Chat response stream ended unexpectedly')
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Chat response stream failed')
  }
}
)

const chatSlice = createSlice({
  initialState,
  name: SliceName.CHAT,
  extraReducers: builder => {
    builder.addCase(sendMessage.pending, state => {
      state.isStreaming = true
      state.streamCompleted = false
      state.streamError = null
      state.streamingAssistantText = ''
    }).addCase(sendMessage.fulfilled, state => {
      state.isStreaming = false
      state.streamCompleted = true
    }).addCase(sendMessage.rejected, (state, action) => {
      state.isStreaming = false
      state.streamCompleted = false
      state.streamError = action.payload ?? action.error.message ?? 'Chat response stream failed'

      if (state.streamingAssistantText === '') state.streamingAssistantText = null
    })
  },
  reducers: {
    appendStreamingAssistantText: (state, action: PayloadAction<string>) => {
      state.streamingAssistantText = (state.streamingAssistantText ?? '') + action.payload
    },
    clearCompletedChatStream: state => {
      if (state.streamCompleted) {
        state.streamCompleted = false
        state.streamingAssistantText = null
      }
    },
    resetChatStream: state => {
      state.isStreaming = false
      state.streamCompleted = false
      state.streamError = null
      state.streamingAssistantText = null
    }
  }
})

export const {
  appendStreamingAssistantText,
  clearCompletedChatStream,
  resetChatStream
} = chatSlice.actions

export default chatSlice.reducer
