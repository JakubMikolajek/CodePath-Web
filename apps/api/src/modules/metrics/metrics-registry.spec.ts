import type { TelemetryEventV1 } from '@workspace/codepath-common/telemetry'
import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService
} from '@workspace/codepath-common/telemetry'

import {
  recordTelemetryMetric,
  renderPrometheusMetrics,
  resetPrometheusMetricsForTests
} from './services/metrics-registry'

function makeEvent(overrides: Partial<TelemetryEventV1>): TelemetryEventV1 {
  return {
    component: 'test.component',
    event: 'test_event',
    level: TelemetryLevel.INFO,
    runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
    schema: 'codepath.telemetry.v1',
    service: TelemetryService.WEB_API,
    timestamp: '2026-03-20T12:00:00.000Z',
    ...overrides
  }
}

describe('metrics', () => {
  beforeEach(() => {
    resetPrometheusMetricsForTests()
  })

  it('increments retry, dlq and timeout counters from telemetry events', () => {
    recordTelemetryMetric(makeEvent({
      event: 'queue_retry_scheduled',
      queueName: 'chat'
    }))
    recordTelemetryMetric(makeEvent({
      event: 'queue_message_moved_to_dlq',
      queueName: 'chat'
    }))
    recordTelemetryMetric(makeEvent({
      event: 'chat_rpc_timeout'
    }))

    const metrics = renderPrometheusMetrics()
    expect(metrics).toContain('codepath_queue_retry_total{service="web-api",queue="chat"} 1')
    expect(metrics).toContain('codepath_queue_dlq_total{service="web-api",queue="chat"} 1')
    expect(metrics).toContain('codepath_chat_rpc_timeout_total{service="web-api"} 1')
  })

  it('observes duration histograms from telemetry events', () => {
    recordTelemetryMetric(makeEvent({
      durationMs: 120,
      event: 'chat_rpc_response_received'
    }))
    recordTelemetryMetric(makeEvent({
      durationMs: 840,
      event: 'docs_generation_completed'
    }))

    const metrics = renderPrometheusMetrics()

    expect(metrics).toContain('codepath_chat_rpc_duration_ms_bucket{service="web-api",le="100"} 0')
    expect(metrics).toContain('codepath_chat_rpc_duration_ms_bucket{service="web-api",le="250"} 1')
    expect(metrics).toContain('codepath_chat_rpc_duration_ms_sum{service="web-api"} 120')
    expect(metrics).toContain('codepath_chat_rpc_duration_ms_count{service="web-api"} 1')
    expect(metrics).toContain('codepath_docs_generation_duration_ms_sum{service="web-api"} 840')
    expect(metrics).toContain('codepath_docs_generation_duration_ms_count{service="web-api"} 1')
  })
})
