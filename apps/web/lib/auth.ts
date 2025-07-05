import { User } from '@/interfaces/auth'
import { apiClient } from '@/lib/api/api'

export async function getCurrentUser() {
  return apiClient.get<User>('/auth/me')
}

export async function login(identifier: string, password: string) {
  return await apiClient.post('/auth/login', { identifier, password })
}

export async function register(email: string, login: string, password: string) {
  return await apiClient.post('/auth/register', { email, login, password })
}
