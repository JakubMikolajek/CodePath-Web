import { create } from 'zustand'

import { sendMessage } from '@/lib/chat'

interface Store {
  sendMessage: (repoId: number, question: string) => Promise<string>
}

export const useChatStore = create<Store>((setState) => ({
  sendMessage: async (repoId, question) => {
    return await sendMessage(repoId, question) as string
  },
}))
