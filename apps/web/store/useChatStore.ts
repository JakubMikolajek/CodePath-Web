import { create } from 'zustand'

import { ChatSession, SessionDetail } from '@/interfaces/chat'
import { createSession, getChatSessions, getSessionDetails, sendMessage } from '@/lib/chat'

interface Store {
  chatSessions: ChatSession[]
  sessionDetails: SessionDetail[]
  getChatSessions: (repoId: number) => Promise<void>
  createSession: (repoId: number) => Promise<void>
  getSessionDetails: (repoId: number, sessionId: string) => Promise<void>
  sendMessage: (repoId: number, question: string, sessionId: string) => Promise<string>
}

export const useChatStore = create<Store>((setState) => ({
  chatSessions: [],
  sessionDetails: [],

  createSession: async (repoId) => {
    await createSession(repoId)
  },

  getChatSessions: async (repoId) => {
    setState(() => ({ chatSessions: [] }))
    const chatSessions = await getChatSessions(repoId)
    setState(() => ({ chatSessions }))
  },

  getSessionDetails: async (repoId, sessionId) => {
    setState(() => ({ sessionDetails: [] }))
    const sessionDetails = await getSessionDetails(repoId, sessionId)
    setState(() => ({ sessionDetails }))
  },

  sendMessage: async (repoId, question, sessionId) => {
    return await sendMessage(repoId, { question, sessionId }) as string
  },
}))
