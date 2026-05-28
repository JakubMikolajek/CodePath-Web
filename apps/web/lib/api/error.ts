import axios from 'axios'

interface ApiErrorResponse {
  message?: string | string[]
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const apiMessage = error.response?.data?.message

    if (Array.isArray(apiMessage)) return apiMessage.join(', ')
    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) return apiMessage
  }

  if (error instanceof Error && error.message.trim().length > 0) return error.message

  return fallbackMessage
}

export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

export function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error

  return new Error(getApiErrorMessage(error, fallbackMessage))
}
