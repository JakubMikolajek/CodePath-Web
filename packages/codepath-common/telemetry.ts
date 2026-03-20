export const TELEMETRY_SCHEMA_V1 = 'codepath.telemetry.v1' as const

export const TELEMETRY_LEVELS = ['info', 'warn', 'error'] as const
export type TelemetryLevel = (typeof TELEMETRY_LEVELS)[number]

export const TELEMETRY_RUNTIME_FAMILIES = ['pipeline', 'semantic'] as const
export type TelemetryRuntimeFamily = (typeof TELEMETRY_RUNTIME_FAMILIES)[number]

export const TELEMETRY_SERVICES = ['web-api', 'ai-worker', 'desktop'] as const
export type TelemetryService = (typeof TELEMETRY_SERVICES)[number]

export const TELEMETRY_STATUSES = ['ok', 'retry', 'dlq', 'timeout', 'error'] as const
export type TelemetryStatus = (typeof TELEMETRY_STATUSES)[number]

export type TelemetryDetailValue = boolean | null | number | string

export interface TelemetryEventV1 {
  component: string
  correlationId?: string
  details?: Record<string, TelemetryDetailValue>
  durationMs?: number
  event: string
  level: TelemetryLevel
  queueName?: string
  repoId?: number
  runtimeFamily: TelemetryRuntimeFamily
  schema: typeof TELEMETRY_SCHEMA_V1
  service: TelemetryService
  status?: TelemetryStatus
  timestamp: string
}

export type EmitTelemetryEventInput = Omit<TelemetryEventV1, 'schema' | 'timestamp'>
