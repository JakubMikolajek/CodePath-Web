import { create } from 'zustand'

import { ChatSession } from '@/interfaces/chat'
import { getChatSessions, sendMessage } from '@/lib/chat'

interface Store {
  chatSessions: ChatSession[]
  getChatSessions: (repoId: number) => Promise<void>
  sendMessage: (repoId: number, question: string) => Promise<string>
}

export const useChatStore = create<Store>((setState) => ({
  chatSessions: [],

  getChatSessions: async (repoId) => {
    setState(() => ({ chatSessions: [] }))
    const chatSessions = await getChatSessions(repoId)
    setState(() => ({ chatSessions }))
  },

  sendMessage: async (repoId, question) => {
    return await sendMessage(repoId, question) as string
  },
}))
