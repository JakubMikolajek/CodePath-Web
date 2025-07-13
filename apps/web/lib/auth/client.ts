import { apiClient } from '@/lib/api/api'

export async function login(identifier: string, password: string) {
  return await apiClient.post('/auth/login', { identifier, password })
}

export async function register(email: string, login: string, password: string) {
  return await apiClient.post('/auth/register', { email, login, password })
}

export async function logout() {
  return await apiClient.get('auth/logout')
}
