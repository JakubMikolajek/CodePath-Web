export interface ChatSession {
  sessionId: string,
  sessionName: string,
  createdAt: Date,
}

export interface SessionDetail {
  id: string
  question: string
  response: string
}
