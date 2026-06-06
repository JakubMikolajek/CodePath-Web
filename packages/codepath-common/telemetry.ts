import { Nullable } from './globals'

export const TELEMETRY_SCHEMA_V1 = 'codepath.telemetry.v1' as const

export enum TelemetryLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum TelemetryRuntimeFamily {
  PIPELINE = 'pipeline',
  SEMANTIC = 'semantic'
}

export enum TelemetryService {
  WEB_API = 'web-api',
  AI_WORKER = 'ai-worker',
  DESKTOP = 'desktop'
}

export enum TelemetryStatus {
  OK = 'ok',
  RETRY = 'retry',
  DLQ = 'dlq',
  TIMEOUT = 'timeout',
  ERROR = 'error'
}

export type TelemetryDetailValue = Nullable<boolean | number | string>

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
