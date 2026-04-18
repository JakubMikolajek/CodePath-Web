import {
  INGEST_CONTRACT_VERSION_V1,
  INGEST_ERROR_CODES,
  INGEST_MESSAGE_JSON_SCHEMA_ID_V1,
  INGEST_MESSAGE_JSON_SCHEMA_V1,
  INGEST_MESSAGE_TYPES,
  INGEST_PRODUCERS,
  IngestMessageType,
  IngestProducer,
  isIngestMessageV1,
  validateIngestConsumerMessageV1,
  validateIngestProducerMessageV1
} from '../../../../packages/codepath-common/ingest'

describe('ingest.v1 contract', () => {
  it('exposes stable version and enum sets', () => {
    expect(INGEST_CONTRACT_VERSION_V1).toBe('ingest.v1')
    expect(INGEST_MESSAGE_TYPES).toEqual([
      'ingest.job.request',
      'ingest.batch.ready',
      'ingest.job.failed'
    ])
    expect(INGEST_PRODUCERS).toEqual([
      'web-api',
      'orchestrator',
      'ingest-service'
    ])
    expect(INGEST_ERROR_CODES).toContain('PARSER_FAILED')
  })

  it('exposes ingest.v1 JSON schema with discriminated variants', () => {
    expect(INGEST_MESSAGE_JSON_SCHEMA_V1.$id).toBe(INGEST_MESSAGE_JSON_SCHEMA_ID_V1)
    expect(Array.isArray(INGEST_MESSAGE_JSON_SCHEMA_V1.oneOf)).toBe(true)
    expect((INGEST_MESSAGE_JSON_SCHEMA_V1.oneOf as unknown[]).length).toBe(3)
  })

  it('validates ingest.job.request payload', () => {
    const message = {
      contractVersion: 'ingest.v1',
      correlationId: 'corr-1',
      messageType: 'ingest.job.request',
      payload: {
        parseOptions: {
          includeConfigFiles: true,
          includeDocumentationFiles: true,
          maxFileBytes: 5_000_000,
          maxSegmentChars: 4_000
        },
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/10/abcdef.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        }
      },
      producedAt: '2026-04-04T20:00:00.000Z',
      producer: 'web-api',
      repoId: 10
    }

    expect(isIngestMessageV1(message)).toBe(true)
  })

  it('rejects invalid version or envelope shape', () => {
    const invalidMessage = {
      contractVersion: 'ingest.v0',
      correlationId: '',
      messageType: 'ingest.job.request',
      payload: {},
      producedAt: 'not-a-date',
      producer: 'web-api',
      repoId: -1
    }

    expect(isIngestMessageV1(invalidMessage)).toBe(false)
  })

  it('validates ingest.batch.ready payload', () => {
    const message = {
      contractVersion: 'ingest.v1',
      correlationId: 'corr-batch-1',
      messageType: 'ingest.batch.ready',
      payload: {
        batchCount: 2,
        batchId: 'batch-1',
        batchIndex: 0,
        isLastBatch: false,
        segments: [{
          content: 'export const x = 1',
          filePath: 'src/a.ts',
          symbolKind: 'function'
        }],
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/10/abcdef.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        },
        stats: {
          filesDiscovered: 20,
          filesParsed: 12,
          segmentsInBatch: 1
        }
      },
      producedAt: '2026-04-04T20:00:00.000Z',
      producer: 'ingest-service',
      repoId: 10
    }

    expect(isIngestMessageV1(message)).toBe(true)
  })

  it('validates ingest.job.failed payload', () => {
    const message = {
      contractVersion: 'ingest.v1',
      correlationId: 'corr-failed-1',
      messageType: 'ingest.job.failed',
      payload: {
        error: {
          code: 'PARSER_FAILED',
          message: 'Tree-sitter failed for file src/a.ts',
          retryable: false
        },
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/10/abcdef.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        },
        stage: 'parsing'
      },
      producedAt: '2026-04-04T20:00:00.000Z',
      producer: 'ingest-service',
      repoId: 10
    }

    expect(isIngestMessageV1(message)).toBe(true)
  })

  it('validates producer constraints', () => {
    const message = {
      contractVersion: 'ingest.v1',
      correlationId: 'corr-producer-1',
      messageType: 'ingest.job.request',
      payload: {
        parseOptions: {
          includeConfigFiles: true,
          includeDocumentationFiles: true,
          maxFileBytes: 5_000_000,
          maxSegmentChars: 4_000
        },
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/10/abcdef.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        }
      },
      producedAt: '2026-04-04T20:00:00.000Z',
      producer: 'web-api',
      repoId: 10
    }

    const validResult = validateIngestProducerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.JobRequest],
      expectedProducer: IngestProducer.WebApi
    })
    expect(validResult.ok).toBe(true)

    const invalidResult = validateIngestProducerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.BatchReady],
      expectedProducer: IngestProducer.IngestService
    })
    expect(invalidResult.ok).toBe(false)
  })

  it('validates consumer constraints', () => {
    const message = {
      contractVersion: 'ingest.v1',
      correlationId: 'corr-consumer-1',
      messageType: 'ingest.batch.ready',
      payload: {
        batchCount: 2,
        batchId: 'batch-1',
        batchIndex: 0,
        isLastBatch: false,
        segments: [{
          content: 'export const x = 1',
          filePath: 'src/a.ts',
          symbolKind: 'function'
        }],
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/10/abcdef.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        },
        stats: {
          filesDiscovered: 20,
          filesParsed: 12,
          segmentsInBatch: 1
        }
      },
      producedAt: '2026-04-04T20:00:00.000Z',
      producer: 'ingest-service',
      repoId: 10
    }

    const validResult = validateIngestConsumerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.BatchReady],
      allowedProducers: [IngestProducer.IngestService]
    })
    expect(validResult.ok).toBe(true)

    const invalidResult = validateIngestConsumerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.JobRequest],
      allowedProducers: [IngestProducer.Orchestrator]
    })
    expect(invalidResult.ok).toBe(false)
  })
})
