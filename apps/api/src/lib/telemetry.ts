import { Logger } from '@nestjs/common'
import {
  type EmitTelemetryEventInput,
  type TelemetryDetailValue,
  type TelemetryEventV1
} from '@workspace/codepath-common/telemetry'

import { recordTelemetryMetric } from './metrics'

const telemetryLogger = new Logger('Telemetry')
const TELEMETRY_SCHEMA_V1 = 'codepath.telemetry.v1' as const

function sanitizeDetails(details?: Record<string, TelemetryDetailValue>) {
  if (!details) {
    return undefined
  }

  const sanitized = Object.fromEntries(
    Object.entries(details).filter(([, value]) => (
      value === null
      || typeof value === 'boolean'
      || typeof value === 'number'
      || typeof value === 'string'
    ))
  ) as Record<string, TelemetryDetailValue>

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function formatEvent(input: EmitTelemetryEventInput): TelemetryEventV1 {
  return {
    ...input,
    details: sanitizeDetails(input.details),
    schema: TELEMETRY_SCHEMA_V1,
    timestamp: new Date().toISOString()
  }
}

export function emitTelemetry(input: EmitTelemetryEventInput): void {
  const event = formatEvent(input)
  const payload = JSON.stringify(event)
  recordTelemetryMetric(event)

  if (event.level === 'error') {
    telemetryLogger.error(payload)
    return
  }

  if (event.level === 'warn') {
    telemetryLogger.warn(payload)
    return
  }

  telemetryLogger.log(payload)
}
