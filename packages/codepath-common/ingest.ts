export const INGEST_CONTRACT_VERSION_V1 = 'ingest.v1' as const

export enum IngestMessageType {
  JobRequest = 'ingest.job.request',
  BatchReady = 'ingest.batch.ready',
  JobFailed = 'ingest.job.failed'
}

export const INGEST_MESSAGE_TYPES = Object.values(IngestMessageType) as IngestMessageType[]

export enum IngestProducer {
  WebApi = 'web-api',
  Orchestrator = 'orchestrator',
  IngestService = 'ingest-service'
}

export const INGEST_PRODUCERS = Object.values(IngestProducer) as IngestProducer[]

export enum IngestErrorCode {
  InvalidPayload = 'INVALID_PAYLOAD',
  MinioNotFound = 'MINIO_NOT_FOUND',
  MinioAccessDenied = 'MINIO_ACCESS_DENIED',
  SnapshotDownloadFailed = 'SNAPSHOT_DOWNLOAD_FAILED',
  SnapshotExtractFailed = 'SNAPSHOT_EXTRACT_FAILED',
  FileDiscoveryFailed = 'FILE_DISCOVERY_FAILED',
  ParserFailed = 'PARSER_FAILED',
  BatchPublishFailed = 'BATCH_PUBLISH_FAILED',
  Unknown = 'UNKNOWN'
}

export const INGEST_ERROR_CODES = Object.values(IngestErrorCode) as IngestErrorCode[]

export const INGEST_JOB_FAILED_STAGES = [
  'batch_publish',
  'file_discovery',
  'parsing',
  'snapshot_download',
  'snapshot_extract',
  'unknown'
] as const
export type IngestJobFailedStageV1 = (typeof INGEST_JOB_FAILED_STAGES)[number]

export interface IngestErrorEnvelopeV1 {
  code: IngestErrorCode
  message: string
  retryable: boolean
  details?: Record<string, boolean | null | number | string>
}

export interface IngestSnapshotRefV1 {
  bucket: string
  key: string
  provider: 'minio'
  sourceCommitSha: string
}

export interface IngestParseOptionsV1 {
  includeConfigFiles: boolean
  includeDocumentationFiles: boolean
  maxFileBytes: number
  maxSegmentChars: number
}

export interface IngestJobRequestPayloadV1 {
  parseOptions: IngestParseOptionsV1
  snapshot: IngestSnapshotRefV1
}

export interface IngestSegmentV1 {
  comment?: string
  content: string
  decorators?: string[]
  endLine?: number
  fileExt?: string
  fileId?: number
  filePath: string
  jsDoc?: string
  language?: string
  params?: string[]
  returnType?: string
  startLine?: number
  symbolKind: string
  symbolName?: string
}

export interface IngestBatchStatsV1 {
  filesDiscovered: number
  filesParsed: number
  segmentsInBatch: number
}

export interface IngestBatchReadyPayloadV1 {
  batchCount: number
  batchId: string
  batchIndex: number
  isLastBatch: boolean
  segments: IngestSegmentV1[]
  snapshot: IngestSnapshotRefV1
  stats: IngestBatchStatsV1
}

export interface IngestJobFailedPayloadV1 {
  error: IngestErrorEnvelopeV1
  stage: IngestJobFailedStageV1
  snapshot: IngestSnapshotRefV1
}

interface IngestEnvelopeBaseV1<TType extends IngestMessageType, TPayload> {
  contractVersion: typeof INGEST_CONTRACT_VERSION_V1
  correlationId: string
  messageType: TType
  payload: TPayload
  producedAt: string
  producer: IngestProducer
  repoId: number
}

export type IngestJobRequestV1 = IngestEnvelopeBaseV1<IngestMessageType.JobRequest, IngestJobRequestPayloadV1>
export type IngestBatchReadyV1 = IngestEnvelopeBaseV1<IngestMessageType.BatchReady, IngestBatchReadyPayloadV1>
export type IngestJobFailedV1 = IngestEnvelopeBaseV1<IngestMessageType.JobFailed, IngestJobFailedPayloadV1>

export type IngestMessageV1 = IngestBatchReadyV1 | IngestJobFailedV1 | IngestJobRequestV1

type JsonSchemaObject = Record<string, unknown>

export const INGEST_MESSAGE_JSON_SCHEMA_ID_V1 = 'codepath.ingest.v1.message' as const

const INGEST_SNAPSHOT_REF_SCHEMA_V1: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    bucket: {
      minLength: 1,
      type: 'string'
    },
    key: {
      minLength: 1,
      type: 'string'
    },
    provider: {
      const: 'minio'
    },
    sourceCommitSha: {
      minLength: 1,
      type: 'string'
    }
  },
  required: ['provider', 'bucket', 'key', 'sourceCommitSha'],
  type: 'object'
}

const INGEST_PARSE_OPTIONS_SCHEMA_V1: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    includeConfigFiles: { type: 'boolean' },
    includeDocumentationFiles: { type: 'boolean' },
    maxFileBytes: {
      exclusiveMinimum: 0,
      type: 'number'
    },
    maxSegmentChars: {
      exclusiveMinimum: 0,
      type: 'number'
    }
  },
  required: ['includeConfigFiles', 'includeDocumentationFiles', 'maxFileBytes', 'maxSegmentChars'],
  type: 'object'
}

const INGEST_SEGMENT_SCHEMA_V1: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    comment: { type: 'string' },
    content: {
      minLength: 1,
      type: 'string'
    },
    decorators: {
      items: { type: 'string' },
      type: 'array'
    },
    endLine: { type: 'number' },
    fileExt: { type: 'string' },
    fileId: { type: 'number' },
    filePath: {
      minLength: 1,
      type: 'string'
    },
    jsDoc: { type: 'string' },
    language: { type: 'string' },
    params: {
      items: { type: 'string' },
      type: 'array'
    },
    returnType: { type: 'string' },
    startLine: { type: 'number' },
    symbolKind: {
      minLength: 1,
      type: 'string'
    },
    symbolName: { type: 'string' }
  },
  required: ['filePath', 'symbolKind', 'content'],
  type: 'object'
}

const INGEST_ERROR_ENVELOPE_SCHEMA_V1: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    code: {
      enum: INGEST_ERROR_CODES
    },
    details: {
      additionalProperties: {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'null' }
        ]
      },
      type: 'object'
    },
    message: {
      minLength: 1,
      type: 'string'
    },
    retryable: { type: 'boolean' }
  },
  required: ['code', 'message', 'retryable'],
  type: 'object'
}

const INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V1: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    contractVersion: {
      const: INGEST_CONTRACT_VERSION_V1
    },
    correlationId: {
      minLength: 1,
      type: 'string'
    },
    producedAt: {
      format: 'date-time',
      type: 'string'
    },
    producer: {
      enum: INGEST_PRODUCERS
    },
    repoId: {
      minimum: 1,
      type: 'integer'
    }
  },
  required: ['contractVersion', 'repoId', 'correlationId', 'producer', 'producedAt', 'payload', 'messageType'],
  type: 'object'
}

const INGEST_JOB_REQUEST_SCHEMA_V1: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V1,
    {
      properties: {
        messageType: {
          const: IngestMessageType.JobRequest
        },
        payload: {
          additionalProperties: false,
          properties: {
            parseOptions: INGEST_PARSE_OPTIONS_SCHEMA_V1,
            snapshot: INGEST_SNAPSHOT_REF_SCHEMA_V1
          },
          required: ['snapshot', 'parseOptions'],
          type: 'object'
        }
      }
    }
  ]
}

const INGEST_BATCH_READY_SCHEMA_V1: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V1,
    {
      properties: {
        messageType: {
          const: IngestMessageType.BatchReady
        },
        payload: {
          additionalProperties: false,
          properties: {
            batchCount: {
              minimum: 1,
              type: 'integer'
            },
            batchId: {
              minLength: 1,
              type: 'string'
            },
            batchIndex: {
              minimum: 0,
              type: 'integer'
            },
            isLastBatch: { type: 'boolean' },
            segments: {
              items: INGEST_SEGMENT_SCHEMA_V1,
              type: 'array'
            },
            snapshot: INGEST_SNAPSHOT_REF_SCHEMA_V1,
            stats: {
              additionalProperties: false,
              properties: {
                filesDiscovered: { minimum: 0, type: 'number' },
                filesParsed: { minimum: 0, type: 'number' },
                segmentsInBatch: { minimum: 0, type: 'number' }
              },
              required: ['filesDiscovered', 'filesParsed', 'segmentsInBatch'],
              type: 'object'
            }
          },
          required: ['batchId', 'batchIndex', 'batchCount', 'isLastBatch', 'snapshot', 'stats', 'segments'],
          type: 'object'
        }
      }
    }
  ]
}

const INGEST_JOB_FAILED_SCHEMA_V1: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V1,
    {
      properties: {
        messageType: {
          const: IngestMessageType.JobFailed
        },
        payload: {
          additionalProperties: false,
          properties: {
            error: INGEST_ERROR_ENVELOPE_SCHEMA_V1,
            snapshot: INGEST_SNAPSHOT_REF_SCHEMA_V1,
            stage: {
              enum: INGEST_JOB_FAILED_STAGES
            }
          },
          required: ['stage', 'snapshot', 'error'],
          type: 'object'
        }
      }
    }
  ]
}

export const INGEST_MESSAGE_JSON_SCHEMA_V1: JsonSchemaObject = {
  $id: INGEST_MESSAGE_JSON_SCHEMA_ID_V1,
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    INGEST_JOB_REQUEST_SCHEMA_V1,
    INGEST_BATCH_READY_SCHEMA_V1,
    INGEST_JOB_FAILED_SCHEMA_V1
  ]
}

export type IngestMessageValidationV1 =
  | { message: IngestMessageV1, ok: true }
  | { errors: string[], ok: false }

export interface IngestProducerValidationOptionsV1 {
  allowedMessageTypes?: IngestMessageType[]
  expectedProducer: IngestProducer
}

export interface IngestConsumerValidationOptionsV1 {
  allowedMessageTypes?: IngestMessageType[]
  allowedProducers?: IngestProducer[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIsoDateString(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isSnapshotRefV1(value: unknown): value is IngestSnapshotRefV1 {
  if (!isRecord(value)) {
    return false
  }

  return value.provider === 'minio'
    && typeof value.bucket === 'string'
    && value.bucket.trim().length > 0
    && typeof value.key === 'string'
    && value.key.trim().length > 0
    && typeof value.sourceCommitSha === 'string'
    && value.sourceCommitSha.trim().length > 0
}

function isParseOptionsV1(value: unknown): value is IngestParseOptionsV1 {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.includeConfigFiles === 'boolean'
    && typeof value.includeDocumentationFiles === 'boolean'
    && typeof value.maxFileBytes === 'number'
    && Number.isFinite(value.maxFileBytes)
    && value.maxFileBytes > 0
    && typeof value.maxSegmentChars === 'number'
    && Number.isFinite(value.maxSegmentChars)
    && value.maxSegmentChars > 0
}

function isIngestSegmentV1(value: unknown): value is IngestSegmentV1 {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.filePath === 'string'
    && value.filePath.trim().length > 0
    && typeof value.symbolKind === 'string'
    && value.symbolKind.trim().length > 0
    && typeof value.content === 'string'
    && value.content.trim().length > 0
}

function isIngestErrorEnvelopeV1(value: unknown): value is IngestErrorEnvelopeV1 {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.code === 'string'
    && INGEST_ERROR_CODES.includes(value.code as IngestErrorCode)
    && typeof value.message === 'string'
    && value.message.trim().length > 0
    && typeof value.retryable === 'boolean'
}

function isMessageBaseV1(value: unknown): value is Omit<IngestEnvelopeBaseV1<IngestMessageType, unknown>, 'payload'> & { payload: unknown } {
  if (!isRecord(value)) {
    return false
  }

  return value.contractVersion === INGEST_CONTRACT_VERSION_V1
    && typeof value.repoId === 'number'
    && Number.isInteger(value.repoId)
    && value.repoId > 0
    && typeof value.correlationId === 'string'
    && value.correlationId.trim().length > 0
    && typeof value.messageType === 'string'
    && INGEST_MESSAGE_TYPES.includes(value.messageType as IngestMessageType)
    && typeof value.producer === 'string'
    && INGEST_PRODUCERS.includes(value.producer as IngestProducer)
    && isIsoDateString(value.producedAt)
    && 'payload' in value
}

export function isIngestMessageV1(value: unknown): value is IngestMessageV1 {
  if (!isMessageBaseV1(value)) {
    return false
  }

  if (value.messageType === IngestMessageType.JobRequest) {
    if (!isRecord(value.payload)) {
      return false
    }

    return isParseOptionsV1(value.payload.parseOptions)
      && isSnapshotRefV1(value.payload.snapshot)
  }

  if (value.messageType === IngestMessageType.BatchReady) {
    if (!isRecord(value.payload)) {
      return false
    }

    return typeof value.payload.batchId === 'string'
      && value.payload.batchId.trim().length > 0
      && typeof value.payload.batchIndex === 'number'
      && Number.isInteger(value.payload.batchIndex)
      && value.payload.batchIndex >= 0
      && typeof value.payload.batchCount === 'number'
      && Number.isInteger(value.payload.batchCount)
      && value.payload.batchCount > 0
      && typeof value.payload.isLastBatch === 'boolean'
      && isSnapshotRefV1(value.payload.snapshot)
      && isRecord(value.payload.stats)
      && typeof value.payload.stats.filesDiscovered === 'number'
      && typeof value.payload.stats.filesParsed === 'number'
      && typeof value.payload.stats.segmentsInBatch === 'number'
      && Array.isArray(value.payload.segments)
      && value.payload.segments.every(isIngestSegmentV1)
  }

  if (!isRecord(value.payload)) {
    return false
  }

  return isSnapshotRefV1(value.payload.snapshot)
    && typeof value.payload.stage === 'string'
    && INGEST_JOB_FAILED_STAGES.includes(value.payload.stage as IngestJobFailedStageV1)
    && isIngestErrorEnvelopeV1(value.payload.error)
}

function normalizeValidationList<T extends string>(values: T[] | undefined, defaults: T[]): T[] {
  const effectiveValues = values ?? defaults
  return [...new Set(effectiveValues)]
}

export function validateIngestProducerMessageV1(
  value: unknown,
  options: IngestProducerValidationOptionsV1
): IngestMessageValidationV1 {
  if (!isIngestMessageV1(value)) {
    return {
      errors: ['Message does not match ingest.v1 contract schema'],
      ok: false
    }
  }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const errors: string[] = []

  if (value.producer !== options.expectedProducer) {
    errors.push(`Unexpected producer '${value.producer}', expected '${options.expectedProducer}'`)
  }

  if (!allowedMessageTypes.includes(value.messageType)) {
    errors.push(`Message type '${value.messageType}' is not allowed for this producer`)
  }

  if (errors.length > 0) {
    return {
      errors,
      ok: false
    }
  }

  return {
    message: value,
    ok: true
  }
}

export function validateIngestConsumerMessageV1(
  value: unknown,
  options: IngestConsumerValidationOptionsV1 = {}
): IngestMessageValidationV1 {
  if (!isIngestMessageV1(value)) {
    return {
      errors: ['Message does not match ingest.v1 contract schema'],
      ok: false
    }
  }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const allowedProducers = normalizeValidationList(options.allowedProducers, INGEST_PRODUCERS)
  const errors: string[] = []

  if (!allowedMessageTypes.includes(value.messageType)) {
    errors.push(`Message type '${value.messageType}' is not allowed for this consumer`)
  }

  if (!allowedProducers.includes(value.producer)) {
    errors.push(`Producer '${value.producer}' is not allowed for this consumer`)
  }

  if (errors.length > 0) {
    return {
      errors,
      ok: false
    }
  }

  return {
    message: value,
    ok: true
  }
}
