import { Logger } from '@nestjs/common'
import {
  TELEMETRY_SCHEMA_V1,
  type TelemetryEventV1,
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'

import { emitTelemetry } from './services/telemetry'

function parseSpyPayload(call: unknown[]): TelemetryEventV1 {
  const rawPayload = call[0]
  if (typeof rawPayload !== 'string') {
    throw new Error('Telemetry log payload must be a string')
  }

  return JSON.parse(rawPayload) as TelemetryEventV1
}

describe('emitTelemetry', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('emits info payload with schema and timestamp', () => {
    const infoSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    emitTelemetry({
      component: 'test.component',
      event: 'test_event',
      level: TelemetryLevel.INFO,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API,
      status: TelemetryStatus.OK
    })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const payload = parseSpyPayload(infoSpy.mock.calls[0] as unknown[])

    expect(payload.schema).toBe('codepath.telemetry.v1')
    expect(typeof payload.timestamp).toBe('string')
    expect(payload.component).toBe('test.component')
    expect(payload.event).toBe('test_event')
    expect(payload.level).toBe(TelemetryLevel.INFO)
  })

  it('matches telemetry contract enums from codepath-common', () => {
    expect(TELEMETRY_SCHEMA_V1).toBe('codepath.telemetry.v1')
    expect(Object.values(TelemetryRuntimeFamily)).toEqual(['pipeline', 'semantic'])
    expect(Object.values(TelemetryService)).toEqual(['web-api', 'ai-worker', 'desktop'])
    expect(Object.values(TelemetryStatus)).toEqual(['ok', 'retry', 'dlq', 'timeout', 'error'])
  })

  it('routes warn and error to proper logger levels', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    emitTelemetry({
      component: 'test.component',
      event: 'warn_event',
      level: TelemetryLevel.WARN,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API
    })
    emitTelemetry({
      component: 'test.component',
      event: 'error_event',
      level: TelemetryLevel.ERROR,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('drops non-primitive details values from payload', () => {
    const infoSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    emitTelemetry({
      component: 'test.component',
      details: {
        // Runtime safety check for non-typed callers.
        invalidObject: { nested: true } as unknown as string,
        validNumber: 2,
        validText: 'ok'
      },
      event: 'details_event',
      level: TelemetryLevel.INFO,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API
    })

    const payload = parseSpyPayload(infoSpy.mock.calls[0] as unknown[])

    expect(payload.details?.validNumber).toBe(2)
    expect(payload.details?.validText).toBe('ok')
    expect(payload.details?.invalidObject).toBeUndefined()
  })

  it('emits payload keys compatible with telemetry v1 contract', () => {
    const infoSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation()

    emitTelemetry({
      component: 'contract.component',
      correlationId: 'corr-123',
      details: { attempt: 1, reason: 'test' },
      durationMs: 120,
      event: 'contract_event',
      level: TelemetryLevel.INFO,
      queueName: 'chat',
      repoId: 17,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API,
      status: TelemetryStatus.OK
    })

    const payload = parseSpyPayload(infoSpy.mock.calls[0] as unknown[])
    expect(Object.keys(payload).sort()).toEqual([
      'component',
      'correlationId',
      'details',
      'durationMs',
      'event',
      'level',
      'queueName',
      'repoId',
      'runtimeFamily',
      'schema',
      'service',
      'status',
      'timestamp'
    ])
  })
})
