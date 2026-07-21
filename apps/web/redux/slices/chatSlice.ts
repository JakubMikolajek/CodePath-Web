import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common'
import type { ChatSession, SessionDetail } from '@workspace/codepath-common/chat'

import {
  createSession as createSessionApi,
  getChatSessions as getChatSessionsApi,
  getSessionDetails as getSessionDetailsApi,
  sendMessage as sendMessageApi
} from '@/lib/chat'
import { SliceName } from '@/redux/sliceName'

interface ChatState {
  chatSessions: ChatSession[]
  error: Nullable<string>
  isStreaming: boolean
  loading: boolean
  sessionDetails: SessionDetail[]
  streamCompleted: boolean
  streamError: Nullable<string>
  streamingAssistantText: Nullable<string>
}

const initialState: ChatState = {
  chatSessions: [],
  error: null,
  isStreaming: false,
  loading: false,
  sessionDetails: [],
  streamCompleted: false,
  streamError: null,
  streamingAssistantText: null
}

export const createSession = createAsyncThunk('chat/createSession', async (repoId: number) => await createSessionApi(repoId))

export const getChatSessions = createAsyncThunk('chat/getChatSessions', async (repoId: number) => await getChatSessionsApi(repoId))

export const getSessionDetails = createAsyncThunk('chat/getSessionDetails', async ({ repoId, sessionId }: { repoId: number; sessionId: string }) => await getSessionDetailsApi(repoId, sessionId))

export const sendMessage = createAsyncThunk<void, { question: string; repoId: number; sessionId: string }, { rejectValue: string }>(
  'chat/sendMessage',
  async ({ question, repoId, sessionId }, { dispatch, rejectWithValue }) => {
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
    builder.addCase(getChatSessions.pending, state => {
      state.chatSessions = []
    }).addCase(getChatSessions.fulfilled, (state, action) => {
      state.chatSessions = action.payload
    }).addCase(getSessionDetails.pending, state => {
      state.sessionDetails = []
    }).addCase(getSessionDetails.fulfilled, (state, action) => {
      state.sessionDetails = action.payload
      if (state.streamCompleted) {
        state.streamCompleted = false
        state.streamingAssistantText = null
      }
    }).addCase(sendMessage.pending, state => {
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
    resetChatStream: state => {
      state.isStreaming = false
      state.streamCompleted = false
      state.streamError = null
      state.streamingAssistantText = null
    }
  }
})

export const { appendStreamingAssistantText, resetChatStream } = chatSlice.actions

export default chatSlice.reducer
