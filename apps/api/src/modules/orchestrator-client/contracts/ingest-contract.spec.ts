import {
  INGEST_CONTRACT_VERSION_V1,
  INGEST_CONTRACT_VERSION_V2,
  INGEST_ERROR_CODES,
  INGEST_MESSAGE_JSON_SCHEMA_ID_V1,
  INGEST_MESSAGE_JSON_SCHEMA_ID_V2,
  INGEST_MESSAGE_JSON_SCHEMA_V1,
  INGEST_MESSAGE_JSON_SCHEMA_V2,
  INGEST_MESSAGE_TYPES,
  INGEST_PRODUCERS,
  IngestMessageType,
  IngestProducer,
  isIngestMessageV1,
  isIngestMessageV2,
  validateIngestConsumerMessageV1,
  validateIngestConsumerMessageV2,
  validateIngestProducerMessageV1,
  validateIngestProducerMessageV2
} from '../../../../../../packages/codepath-common/ingest'

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
      allowedMessageTypes: [IngestMessageType.JOB_REQUEST],
      expectedProducer: IngestProducer.WEB_API
    })
    expect(validResult.ok).toBe(true)

    const invalidResult = validateIngestProducerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.BATCH_READY],
      expectedProducer: IngestProducer.INGEST_SERVICE
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
      allowedMessageTypes: [IngestMessageType.BATCH_READY],
      allowedProducers: [IngestProducer.INGEST_SERVICE]
    })
    expect(validResult.ok).toBe(true)

    const invalidResult = validateIngestConsumerMessageV1(message, {
      allowedMessageTypes: [IngestMessageType.JOB_REQUEST],
      allowedProducers: [IngestProducer.ORCHESTRATOR]
    })
    expect(invalidResult.ok).toBe(false)
  })
})

describe('ingest.v2 contract', () => {
  it('exposes stable version and JSON schema with discriminated variants', () => {
    expect(INGEST_CONTRACT_VERSION_V2).toBe('ingest.v2')
    expect(INGEST_MESSAGE_JSON_SCHEMA_V2.$id).toBe(INGEST_MESSAGE_JSON_SCHEMA_ID_V2)
    expect(Array.isArray(INGEST_MESSAGE_JSON_SCHEMA_V2.oneOf)).toBe(true)
    expect((INGEST_MESSAGE_JSON_SCHEMA_V2.oneOf as unknown[]).length).toBe(3)
  })

  it('validates ingest.job.request payload', () => {
    const message = {
      contractVersion: 'ingest.v2',
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

    expect(isIngestMessageV2(message)).toBe(true)
  })

  it('validates ingest.batch.ready semantic segment payload', () => {
    const message = {
      contractVersion: 'ingest.v2',
      correlationId: 'corr-batch-1',
      messageType: 'ingest.batch.ready',
      payload: {
        batchCount: 1,
        batchId: 'batch-1',
        batchIndex: 0,
        isLastBatch: true,
        segments: [{
          astPath: ['program', 'function_declaration'],
          category: 'code',
          chunkCount: 1,
          chunkIndex: 0,
          comment: '/** Builds x. */',
          content: 'export function x() { return 1 }',
          contentSha256: 'f'.repeat(64),
          decorators: ['@Trace()'],
          endByte: 30,
          endLine: 1,
          fileExt: '.ts',
          filePath: 'src/a.ts',
          httpMethod: 'GET',
          importSpecifiers: ['@nestjs/common', '../repo.service'],
          jsDoc: '/** Builds x. */',
          language: 'typescript',
          nodeType: 'function_declaration',
          params: ['name: string'],
          parseStrategy: 'tree_sitter',
          returnType: 'number',
          routePath: '/repos/:id',
          segmentId: 'src/a.ts:function:x:1:1',
          startByte: 0,
          startLine: 1,
          symbolKind: 'function',
          symbolName: 'x'
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

    expect(isIngestMessageV2(message)).toBe(true)
  })

  it('rejects legacy v1 messages for v2 validators', () => {
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

    expect(isIngestMessageV2(message)).toBe(false)
  })

  it('validates v2 producer and consumer constraints', () => {
    const producerMessage = {
      contractVersion: 'ingest.v2',
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

    expect(validateIngestProducerMessageV2(producerMessage, {
      allowedMessageTypes: [IngestMessageType.JOB_REQUEST],
      expectedProducer: IngestProducer.WEB_API
    }).ok).toBe(true)

    expect(validateIngestConsumerMessageV2(producerMessage, {
      allowedMessageTypes: [IngestMessageType.BATCH_READY],
      allowedProducers: [IngestProducer.INGEST_SERVICE]
    }).ok).toBe(false)
  })
})
