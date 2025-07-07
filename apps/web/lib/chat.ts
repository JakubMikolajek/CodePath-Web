import { apiClient } from '@/lib/api/api'

export async function sendMessage (repoId: number, question: string) {
  return await apiClient.post(`/chat/${repoId}`, { question })
}
