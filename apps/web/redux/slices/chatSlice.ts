import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { ChatSession, SessionDetail } from '@workspace/codepath-common/chat'

import {
  createSession as createSessionApi,
  getChatSessions as getChatSessionsApi,
  getSessionDetails as getSessionDetailsApi,
  sendMessage as sendMessageApi
} from '@/lib/chat'

interface ChatState {
  chatSessions: ChatSession[]
  error: null | string
  loading: boolean
  sessionDetails: SessionDetail[]
}

const initialState: ChatState = {
  chatSessions: [],
  error: null,
  loading: false,
  sessionDetails: []
}

export const createSession = createAsyncThunk('chat/createSession',
  async (repoId: number) => {
    await createSessionApi(repoId)
  }
)

export const getChatSessions = createAsyncThunk('chat/getChatSessions',
  async (repoId: number) => {
    return await getChatSessionsApi(repoId)
  }
)

export const getSessionDetails = createAsyncThunk('chat/getSessionDetails',
  async ({ repoId, sessionId }: { repoId: number; sessionId: string }) => {
    return await getSessionDetailsApi(repoId, sessionId)
  }
)

export const sendMessage = createAsyncThunk('chat/sendMessage',
  async ({ question, repoId, sessionId }: { question: string; repoId: number; sessionId: string }) => {
    return await sendMessageApi(repoId, { question, sessionId }) as string
  }
)

const chatSlice = createSlice({
  initialState,
  name: 'chat',
  reducers: {},
  extraReducers: builder => {
    builder.addCase(getChatSessions.pending, state => {
      state.chatSessions = []
    }).addCase(getChatSessions.fulfilled, (state, action) => {
      state.chatSessions = action.payload
    }).addCase(getSessionDetails.pending, state => {
      state.sessionDetails = []
    }).addCase(getSessionDetails.fulfilled, (state, action) => {
      state.sessionDetails = action.payload
    })
  }
})

export default chatSlice.reducer
