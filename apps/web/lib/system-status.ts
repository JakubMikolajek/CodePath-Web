import { apiClient } from '@/lib/api/api'

export type SystemComponentStatusValue = 'degraded' | 'down' | 'ok'

export interface SystemComponentStatus {
  checkedAt: string
  details?: Record<string, number | string>
  latencyMs: number
  message: string
  name: string
  status: SystemComponentStatusValue
}

export interface SystemStatusResponse {
  checkedAt: string
  components: SystemComponentStatus[]
  status: SystemComponentStatusValue
}

export async function getSystemStatus() {
  return await apiClient.get<SystemStatusResponse>('/system/status')
}
