// Canonical ingest message contract shared across CodePath-Ingest (Rust), CodePath-AI (Python),
// and CodePath-Orchestrator (Rust). Any shape change here must be coordinated across all three
// consumers before deploying. v1 is legacy (no segmentId, no category, no parseStrategy);
// v2 is the active contract. New work must use v2 types and validators.
import {Nullable, Undefinable} from "./globals";

// v1 is kept for backward-compatibility validation only — do not produce new v1 messages.
export const INGEST_CONTRACT_VERSION_V1 = 'ingest.v1' as const
export const INGEST_CONTRACT_VERSION_V2 = 'ingest.v2' as const

export enum StorageProvider {
  MINIO = 'minio',
  LOCAL = 'local'
}

export enum IngestMessageType {
  JOB_REQUEST = 'ingest.job.request',
  BATCH_READY = 'ingest.batch.ready',
  JOB_FAILED = 'ingest.job.failed'
}

export const INGEST_MESSAGE_TYPES = Object.values(IngestMessageType) as IngestMessageType[]

export enum IngestProducer {
  WEB_API = 'web-api',
  ORCHESTRATOR = 'orchestrator',
  INGEST_SERVICE = 'ingest-service'
}

export const INGEST_PRODUCERS = Object.values(IngestProducer) as IngestProducer[]

export enum IngestErrorCode {
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  MINIO_NOT_FOUND = 'MINIO_NOT_FOUND',
  MINIO_ACCESS_DENIED = 'MINIO_ACCESS_DENIED',
  SNAPSHOT_DOWNLOAD_FAILED = 'SNAPSHOT_DOWNLOAD_FAILED',
  SNAPSHOT_EXTRACT_FAILED = 'SNAPSHOT_EXTRACT_FAILED',
  FILE_DISCOVERY_FAILED = 'FILE_DISCOVERY_FAILED',
  PARSER_FAILED = 'PARSER_FAILED',
  BATCH_PUBLISH_FAILED = 'BATCH_PUBLISH_FAILED',
  UNKNOWN = 'UNKNOWN'
}

export const INGEST_ERROR_CODES = Object.values(IngestErrorCode) as IngestErrorCode[]

// TODO maybe enum will be better
export const INGEST_JOB_FAILED_STAGES = [
  'batch_publish',
  'file_discovery',
  'parsing',
  'snapshot_download',
  'snapshot_extract',
  'unknown'
] as const

export type IngestJobFailedStageV1 = (typeof INGEST_JOB_FAILED_STAGES)[number]
export type IngestJobFailedStageV2 = (typeof INGEST_JOB_FAILED_STAGES)[number]

export const INGEST_SEGMENT_CATEGORIES_V2 = ['code', 'config', 'documentation'] as const
export type IngestSegmentCategoryV2 = (typeof INGEST_SEGMENT_CATEGORIES_V2)[number]

export const INGEST_PARSE_STRATEGIES_V2 = ['tree_sitter', 'text_fallback'] as const
export type IngestParseStrategyV2 = (typeof INGEST_PARSE_STRATEGIES_V2)[number]

export interface IngestErrorEnvelopeV1 {
  code: IngestErrorCode
  message: string
  retryable: boolean
  details?: Record<string, Nullable<boolean| number | string>>
}

export interface IngestSnapshotRefV1 {
  bucket: string
  key: string
  provider: StorageProvider
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

export interface IngestSnapshotRefV2 extends IngestSnapshotRefV1 {}

export interface IngestParseOptionsV2 extends IngestParseOptionsV1 {}

export interface IngestJobRequestPayloadV2 {
  parseOptions: IngestParseOptionsV2
  snapshot: IngestSnapshotRefV2
}

export interface IngestSegmentV2 {
  astPath?: string[]
  category: IngestSegmentCategoryV2
  chunkCount: number
  chunkIndex: number
  comment?: string
  content: string
  // SHA-256 of the raw segment content, used by the embedding worker to skip re-embedding
  // unchanged segments on incremental ingest passes.
  contentSha256: string
  decorators?: string[]
  endByte?: number
  endLine?: number
  fallbackReason?: string
  fileExt?: string
  filePath: string
  httpMethod?: string
  importSpecifiers?: string[]
  jsDoc?: string
  language?: string
  nodeType?: string
  parentSymbolName?: string
  params?: string[]
  parseStrategy: IngestParseStrategyV2
  returnType?: string
  routePath?: string
  segmentId: string
  startByte?: number
  startLine?: number
  symbolKind: string
  symbolName?: string
}

export interface IngestBatchStatsV2 extends IngestBatchStatsV1 {}

export interface IngestBatchReadyPayloadV2 {
  batchCount: number
  // Deterministic hash of the full ingest job (request + all segments). Same input always
  // produces the same batchId, which makes retries idempotent — the embedding worker can
  // detect and skip already-processed batches. Never generate batchId outside contract.rs.
  batchId: string
  batchIndex: number
  isLastBatch: boolean
  segments: IngestSegmentV2[]
  snapshot: IngestSnapshotRefV2
  stats: IngestBatchStatsV2
}

export interface IngestErrorEnvelopeV2 extends IngestErrorEnvelopeV1 {}

export interface IngestJobFailedPayloadV2 {
  error: IngestErrorEnvelopeV2
  stage: IngestJobFailedStageV2
  snapshot: IngestSnapshotRefV2
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

interface IngestEnvelopeBaseV2<TType extends IngestMessageType, TPayload> {
  contractVersion: typeof INGEST_CONTRACT_VERSION_V2
  correlationId: string
  messageType: TType
  payload: TPayload
  producedAt: string
  producer: IngestProducer
  repoId: number
}

export type IngestJobRequestV1 = IngestEnvelopeBaseV1<IngestMessageType.JOB_REQUEST, IngestJobRequestPayloadV1>
export type IngestBatchReadyV1 = IngestEnvelopeBaseV1<IngestMessageType.BATCH_READY, IngestBatchReadyPayloadV1>
export type IngestJobFailedV1 = IngestEnvelopeBaseV1<IngestMessageType.JOB_FAILED, IngestJobFailedPayloadV1>

export type IngestMessageV1 = IngestBatchReadyV1 | IngestJobFailedV1 | IngestJobRequestV1

export type IngestJobRequestV2 = IngestEnvelopeBaseV2<IngestMessageType.JOB_REQUEST, IngestJobRequestPayloadV2>
export type IngestBatchReadyV2 = IngestEnvelopeBaseV2<IngestMessageType.BATCH_READY, IngestBatchReadyPayloadV2>
export type IngestJobFailedV2 = IngestEnvelopeBaseV2<IngestMessageType.JOB_FAILED, IngestJobFailedPayloadV2>

export type IngestMessageV2 = IngestBatchReadyV2 | IngestJobFailedV2 | IngestJobRequestV2

type JsonSchemaObject = Record<string, unknown>

export const INGEST_MESSAGE_JSON_SCHEMA_ID_V1 = 'codepath.ingest.v1.message' as const
export const INGEST_MESSAGE_JSON_SCHEMA_ID_V2 = 'codepath.ingest.v2.message' as const

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
    httpMethod: { type: 'string' },
    importSpecifiers: {
      items: { type: 'string' },
      type: 'array'
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

const INGEST_SEGMENT_SCHEMA_V2: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    astPath: {
      items: { type: 'string' },
      type: 'array'
    },
    category: {
      enum: INGEST_SEGMENT_CATEGORIES_V2
    },
    chunkCount: {
      minimum: 1,
      type: 'integer'
    },
    chunkIndex: {
      minimum: 0,
      type: 'integer'
    },
    content: {
      minLength: 1,
      type: 'string'
    },
    contentSha256: {
      minLength: 64,
      type: 'string'
    },
    comment: { type: 'string' },
    decorators: {
      items: { type: 'string' },
      type: 'array'
    },
    endByte: { minimum: 0, type: 'integer' },
    endLine: { minimum: 1, type: 'integer' },
    fallbackReason: { type: 'string' },
    fileExt: { type: 'string' },
    filePath: {
      minLength: 1,
      type: 'string'
    },
    jsDoc: { type: 'string' },
    language: { type: 'string' },
    nodeType: { type: 'string' },
    parentSymbolName: { type: 'string' },
    params: {
      items: { type: 'string' },
      type: 'array'
    },
    parseStrategy: {
      enum: INGEST_PARSE_STRATEGIES_V2
    },
    returnType: { type: 'string' },
    routePath: { type: 'string' },
    segmentId: {
      minLength: 1,
      type: 'string'
    },
    startByte: { minimum: 0, type: 'integer' },
    startLine: { minimum: 1, type: 'integer' },
    symbolKind: {
      minLength: 1,
      type: 'string'
    },
    symbolName: { type: 'string' }
  },
  required: [
    'segmentId',
    'filePath',
    'category',
    'parseStrategy',
    'symbolKind',
    'content',
    'contentSha256',
    'chunkIndex',
    'chunkCount'
  ],
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

const INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V2: JsonSchemaObject = {
  additionalProperties: false,
  properties: {
    contractVersion: {
      const: INGEST_CONTRACT_VERSION_V2
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
          const: IngestMessageType.JOB_REQUEST
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

const INGEST_JOB_REQUEST_SCHEMA_V2: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V2,
    {
      properties: {
        messageType: {
          const: IngestMessageType.JOB_REQUEST
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
          const: IngestMessageType.BATCH_READY
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

const INGEST_BATCH_READY_SCHEMA_V2: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V2,
    {
      properties: {
        messageType: {
          const: IngestMessageType.BATCH_READY
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
              items: INGEST_SEGMENT_SCHEMA_V2,
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
          const: IngestMessageType.JOB_FAILED
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

const INGEST_JOB_FAILED_SCHEMA_V2: JsonSchemaObject = {
  allOf: [
    INGEST_MESSAGE_ENVELOPE_BASE_SCHEMA_V2,
    {
      properties: {
        messageType: {
          const: IngestMessageType.JOB_FAILED
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

export const INGEST_MESSAGE_JSON_SCHEMA_V2: JsonSchemaObject = {
  $id: INGEST_MESSAGE_JSON_SCHEMA_ID_V2,
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    INGEST_JOB_REQUEST_SCHEMA_V2,
    INGEST_BATCH_READY_SCHEMA_V2,
    INGEST_JOB_FAILED_SCHEMA_V2
  ]
}

export type IngestMessageValidationV1 = { message: IngestMessageV1, ok: true } | { errors: string[], ok: false }

export type IngestMessageValidationV2 = { message: IngestMessageV2, ok: true } | { errors: string[], ok: false }

export interface IngestProducerValidationOptionsV1 {
  allowedMessageTypes?: IngestMessageType[]
  expectedProducer: IngestProducer
}

export interface IngestProducerValidationOptionsV2 {
  allowedMessageTypes?: IngestMessageType[]
  expectedProducer: IngestProducer
}

export interface IngestConsumerValidationOptionsV1 {
  allowedMessageTypes?: IngestMessageType[]
  allowedProducers?: IngestProducer[]
}

export interface IngestConsumerValidationOptionsV2 {
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
  if (!isRecord(value)) return false

  return value.provider === StorageProvider.MINIO
    && typeof value.bucket === 'string'
    && value.bucket.trim().length > 0
    && typeof value.key === 'string'
    && value.key.trim().length > 0
    && typeof value.sourceCommitSha === 'string'
    && value.sourceCommitSha.trim().length > 0
}

function isParseOptionsV1(value: unknown): value is IngestParseOptionsV1 {
  if (!isRecord(value)) return false

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
  if (!isRecord(value)) return false

  return typeof value.filePath === 'string'
    && value.filePath.trim().length > 0
    && typeof value.symbolKind === 'string'
    && value.symbolKind.trim().length > 0
    && typeof value.content === 'string'
    && value.content.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isOptionalInteger(value: unknown, minimum: number): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= minimum)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isIngestSegmentV2(value: unknown): value is IngestSegmentV2 {
  if (!isRecord(value)) return false

  // Long chain because AJV is not a dependency here — this file is consumed by both
  // the Node.js API and browser bundles, so we use hand-rolled guards instead.
  return typeof value.segmentId === 'string'
    && value.segmentId.trim().length > 0
    && typeof value.filePath === 'string'
    && value.filePath.trim().length > 0
    && typeof value.category === 'string'
    && INGEST_SEGMENT_CATEGORIES_V2.includes(value.category as IngestSegmentCategoryV2)
    && typeof value.parseStrategy === 'string'
    && INGEST_PARSE_STRATEGIES_V2.includes(value.parseStrategy as IngestParseStrategyV2)
    && typeof value.symbolKind === 'string'
    && value.symbolKind.trim().length > 0
    && typeof value.content === 'string'
    && value.content.trim().length > 0
    && typeof value.contentSha256 === 'string'
    && value.contentSha256.trim().length >= 64
    && typeof value.chunkIndex === 'number'
    && Number.isInteger(value.chunkIndex)
    && value.chunkIndex >= 0
    && typeof value.chunkCount === 'number'
    && Number.isInteger(value.chunkCount)
    && value.chunkCount > 0
    && value.chunkIndex < value.chunkCount
    && isOptionalInteger(value.startLine, 1)
    && isOptionalInteger(value.endLine, 1)
    && isOptionalInteger(value.startByte, 0)
    && isOptionalInteger(value.endByte, 0)
    && isOptionalString(value.fileExt)
    && isOptionalString(value.language)
    && isOptionalString(value.fallbackReason)
    && isOptionalString(value.httpMethod)
    && isOptionalString(value.nodeType)
    && isOptionalString(value.parentSymbolName)
    && isOptionalString(value.symbolName)
    && isOptionalString(value.comment)
    && isOptionalString(value.jsDoc)
    && isOptionalString(value.returnType)
    && isOptionalString(value.routePath)
    && (value.decorators === undefined || isStringArray(value.decorators))
    && (value.importSpecifiers === undefined || isStringArray(value.importSpecifiers))
    && (value.params === undefined || isStringArray(value.params))
    && (value.astPath === undefined || isStringArray(value.astPath))
}

function isIngestErrorEnvelopeV1(value: unknown): value is IngestErrorEnvelopeV1 {
  if (!isRecord(value)) return false

  return typeof value.code === 'string'
    && INGEST_ERROR_CODES.includes(value.code as IngestErrorCode)
    && typeof value.message === 'string'
    && value.message.trim().length > 0
    && typeof value.retryable === 'boolean'
}

function isMessageBaseV1(value: unknown): value is Omit<IngestEnvelopeBaseV1<IngestMessageType, unknown>, 'payload'> & { payload: unknown } {
  if (!isRecord(value)) return false

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

function isMessageBaseV2(value: unknown): value is Omit<IngestEnvelopeBaseV2<IngestMessageType, unknown>, 'payload'> & { payload: unknown } {
  if (!isRecord(value)) return false

  return value.contractVersion === INGEST_CONTRACT_VERSION_V2
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
  if (!isMessageBaseV1(value)) return false

  if (value.messageType === IngestMessageType.JOB_REQUEST) {
    if (!isRecord(value.payload)) return false

    return isParseOptionsV1(value.payload.parseOptions) && isSnapshotRefV1(value.payload.snapshot)
  }

  if (value.messageType === IngestMessageType.BATCH_READY) {
    if (!isRecord(value.payload)) return false

    return isBatchReadyPayload(value.payload, isIngestSegmentV1)
  }

  if (!isRecord(value.payload)) {
    return false
  }

  return isSnapshotRefV1(value.payload.snapshot)
    && typeof value.payload.stage === 'string'
    && INGEST_JOB_FAILED_STAGES.includes(value.payload.stage as IngestJobFailedStageV1)
    && isIngestErrorEnvelopeV1(value.payload.error)
}

export function isIngestMessageV2(value: unknown): value is IngestMessageV2 {
  if (!isMessageBaseV2(value)) return false

  if (value.messageType === IngestMessageType.JOB_REQUEST) {
    if (!isRecord(value.payload)) return false

    return isParseOptionsV1(value.payload.parseOptions) && isSnapshotRefV1(value.payload.snapshot)
  }

  if (value.messageType === IngestMessageType.BATCH_READY) {
    if (!isRecord(value.payload)) return false

    return isBatchReadyPayload(value.payload, isIngestSegmentV2)
  }

  if (!isRecord(value.payload)) return false

  return isSnapshotRefV1(value.payload.snapshot) && typeof value.payload.stage === 'string' && INGEST_JOB_FAILED_STAGES.includes(value.payload.stage as IngestJobFailedStageV2) && isIngestErrorEnvelopeV1(value.payload.error)
}

function normalizeValidationList<T extends string>(values: Undefinable<T[]>, defaults: T[]): T[] {
  const effectiveValues = values ?? defaults
  return [...new Set(effectiveValues)]
}

// Validates that a message was produced by the expected producer and has an allowed type.
// Use on the producer side before publishing to guarantee contract compliance.
export function validateIngestProducerMessageV1(value: unknown, options: IngestProducerValidationOptionsV1): IngestMessageValidationV1 {
  if (!isIngestMessageV1(value)) return { errors: ['Message does not match ingest.v1 contract schema'], ok: false }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const errors: string[] = []

  if (value.producer !== options.expectedProducer) errors.push(`Unexpected producer '${value.producer}', expected '${options.expectedProducer}'`)
  if (!allowedMessageTypes.includes(value.messageType)) errors.push(`Message type '${value.messageType}' is not allowed for this producer`)
  if (errors.length > 0) return { errors, ok: false }

  return { message: value, ok: true }
}

// v2 equivalent of validateIngestProducerMessageV1 — use this for all new producers.
export function validateIngestProducerMessageV2(value: unknown, options: IngestProducerValidationOptionsV2): IngestMessageValidationV2 {
  if (!isIngestMessageV2(value)) return { errors: ['Message does not match ingest.v2 contract schema'], ok: false }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const errors: string[] = []

  if (value.producer !== options.expectedProducer) errors.push(`Unexpected producer '${value.producer}', expected '${options.expectedProducer}'`)
  if (!allowedMessageTypes.includes(value.messageType)) errors.push(`Message type '${value.messageType}' is not allowed for this producer`)
  if (errors.length > 0) return { errors, ok: false }

  return { message: value, ok: true }
}

// Validates an incoming message on the consumer side — checks shape, allowed producers,
// and allowed message types. Defaults to permitting all known producers and types.
export function validateIngestConsumerMessageV1(value: unknown, options: IngestConsumerValidationOptionsV1 = {}): IngestMessageValidationV1 {
  if (!isIngestMessageV1(value)) return { errors: ['Message does not match ingest.v1 contract schema'], ok: false }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const allowedProducers = normalizeValidationList(options.allowedProducers, INGEST_PRODUCERS)
  const errors: string[] = []

  if (!allowedMessageTypes.includes(value.messageType)) errors.push(`Message type '${value.messageType}' is not allowed for this consumer`)
  if (!allowedProducers.includes(value.producer)) errors.push(`Producer '${value.producer}' is not allowed for this consumer`)
  if (errors.length > 0) return { errors, ok: false }

  return { message: value, ok: true }
}

// v2 equivalent of validateIngestConsumerMessageV1 — use this for all new consumers.
export function validateIngestConsumerMessageV2(value: unknown, options: IngestConsumerValidationOptionsV2 = {}): IngestMessageValidationV2 {
  if (!isIngestMessageV2(value)) return { errors: ['Message does not match ingest.v2 contract schema'], ok: false }

  const allowedMessageTypes = normalizeValidationList(options.allowedMessageTypes, INGEST_MESSAGE_TYPES)
  const allowedProducers = normalizeValidationList(options.allowedProducers, INGEST_PRODUCERS)
  const errors: string[] = []

  if (!allowedMessageTypes.includes(value.messageType)) errors.push(`Message type '${value.messageType}' is not allowed for this consumer`)
  if (!allowedProducers.includes(value.producer)) errors.push(`Producer '${value.producer}' is not allowed for this consumer`)
  if (errors.length > 0) return { errors, ok: false }

  return { message: value, ok: true }
}

export function isBatchReadyPayload(payload: unknown, segmentValidator: (value: unknown) => boolean): boolean {
  if (!isRecord(payload)) return false

  return typeof payload.batchId === 'string'
    && payload.batchId.trim().length > 0
    && typeof payload.batchIndex === 'number'
    && Number.isInteger(payload.batchIndex)
    && payload.batchIndex >= 0
    && typeof payload.batchCount === 'number'
    && Number.isInteger(payload.batchCount)
    && payload.batchCount > 0
    && typeof payload.isLastBatch === 'boolean'
    && isSnapshotRefV1(payload.snapshot)
    && isRecord(payload.stats)
    && typeof payload.stats.filesDiscovered === 'number'
    && typeof payload.stats.filesParsed === 'number'
    && typeof payload.stats.segmentsInBatch === 'number'
    && Array.isArray(payload.segments)
    && payload.segments.every(segmentValidator)
}