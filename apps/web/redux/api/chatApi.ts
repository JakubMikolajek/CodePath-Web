import type { ChatSession, SessionDetail } from '@workspace/codepath-common/chat'

import { clearCompletedChatStream } from '@/redux/slices/chatSlice'

import { baseApi } from './baseApi'

const chatApiWithTags = baseApi.enhanceEndpoints({ addTagTypes: ['ChatSessions', 'ChatSessionDetails'] })

export const chatApi = chatApiWithTags.injectEndpoints({
  endpoints: builder => ({
    createSession: builder.mutation<void, number>({
      invalidatesTags: (_result, _error, repoId) => [{ id: repoId, type: 'ChatSessions' }],
      query: repoId => ({ url: `/chat/${repoId}/createSession` })
    }),
    getChatSessions: builder.query<ChatSession[], number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'ChatSessions' }],
      query: repoId => ({ url: `/chat/${repoId}` })
    }),
    getSessionDetails: builder.query<SessionDetail[], { repoId: number; sessionId: string; }>({
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(clearCompletedChatStream())
        } catch {
          // Keep the completed stream visible when history refresh fails.
        }
      },
      providesTags: (_result, _error, { repoId, sessionId }) => [{ id: `${repoId}:${sessionId}`, type: 'ChatSessionDetails' }],
      query: ({ repoId, sessionId }) => ({ url: `/chat/${repoId}/${sessionId}` })
    })
  })
})

export const {
  useCreateSessionMutation,
  useGetChatSessionsQuery,
  useGetSessionDetailsQuery
} = chatApi
