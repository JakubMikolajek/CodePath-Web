import { create } from 'zustand'

import { ChatSession, SessionDetail } from '@/interfaces/chat'
import { getChatSessions, getSessionDetails, sendMessage } from '@/lib/chat'

interface Store {
  chatSessions: ChatSession[]
  sessionDetails: SessionDetail[]
  getChatSessions: (repoId: number) => Promise<void>
  getSessionDetails: (repoId: number, sessionId: string) => Promise<void>
  sendMessage: (repoId: number, question: string) => Promise<string>
}

export const useChatStore = create<Store>((setState) => ({
  chatSessions: [],
  sessionDetails: [],

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

  sendMessage: async (repoId, question) => {
    return await sendMessage(repoId, question) as string
  },
}))
