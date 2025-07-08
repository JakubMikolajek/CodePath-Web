import { ChatSession, SessionDetail } from '@/interfaces/chat'
import { apiClient } from '@/lib/api/api'

export async function sendMessage (repoId: number, question: string) {
  return await apiClient.post(`/chat/${repoId}`, { question })
}

export async function getChatSessions (repoId: number) {
  return await apiClient.get<ChatSession[]>(`/chat/${repoId}`)
}

export async function getSessionDetails (repoId: number, sessionId: string) {
  return await apiClient.get<SessionDetail[]>(`/chat/${repoId}/${sessionId}`)
}
