import { Logger } from '@nestjs/common'
import type { TelemetryEventV1 } from '@workspace/codepath-common/telemetry'

import { emitTelemetry } from './telemetry'

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
      level: 'info',
      runtimeFamily: 'pipeline',
      service: 'web-api',
      status: 'ok'
    })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const payload = parseSpyPayload(infoSpy.mock.calls[0] as unknown[])

    expect(payload.schema).toBe('codepath.telemetry.v1')
    expect(typeof payload.timestamp).toBe('string')
    expect(payload.component).toBe('test.component')
    expect(payload.event).toBe('test_event')
    expect(payload.level).toBe('info')
  })

  it('routes warn and error to proper logger levels', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    emitTelemetry({
      component: 'test.component',
      event: 'warn_event',
      level: 'warn',
      runtimeFamily: 'pipeline',
      service: 'web-api'
    })
    emitTelemetry({
      component: 'test.component',
      event: 'error_event',
      level: 'error',
      runtimeFamily: 'pipeline',
      service: 'web-api'
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
      level: 'info',
      runtimeFamily: 'pipeline',
      service: 'web-api'
    })

    const payload = parseSpyPayload(infoSpy.mock.calls[0] as unknown[])

    expect(payload.details?.validNumber).toBe(2)
    expect(payload.details?.validText).toBe('ok')
    expect(payload.details?.invalidObject).toBeUndefined()
  })
})
