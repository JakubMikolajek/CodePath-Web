import type { IngestJobRequestV2 } from '@workspace/codepath-common/ingest'

const INGEST_CONTRACT_VERSION_V2 = 'ingest.v2'
const INGEST_MESSAGE_TYPE_JOB_REQUEST = 'ingest.job.request'
const INGEST_PRODUCER_WEB_API = 'web-api'
const INGEST_SNAPSHOT_PROVIDER_MINIO = 'minio'

export function assertValidIngestJobRequestFromWeb(message: IngestJobRequestV2): void {
  if (message.contractVersion !== INGEST_CONTRACT_VERSION_V2) throw new Error(`ingest.contractVersion must be '${INGEST_CONTRACT_VERSION_V2}'`)
  if (message.messageType !== INGEST_MESSAGE_TYPE_JOB_REQUEST) throw new Error(`ingest.messageType must be '${INGEST_MESSAGE_TYPE_JOB_REQUEST}'`)
  if (message.producer !== INGEST_PRODUCER_WEB_API) throw new Error(`ingest.producer must be '${INGEST_PRODUCER_WEB_API}'`)
  if (!Number.isInteger(message.repoId) || message.repoId <= 0) throw new Error('ingest.repoId must be a positive integer')
  if (typeof message.correlationId !== 'string' || message.correlationId.trim().length === 0) throw new Error('ingest.correlationId must be a non-empty string')
  if (typeof message.producedAt !== 'string' || Number.isNaN(Date.parse(message.producedAt))) throw new Error('ingest.producedAt must be a valid ISO-8601 datetime string')
  if (message.payload.snapshot.provider !== INGEST_SNAPSHOT_PROVIDER_MINIO) throw new Error(`ingest.payload.snapshot.provider must be '${INGEST_SNAPSHOT_PROVIDER_MINIO}'`)
  if (message.payload.snapshot.bucket.trim().length === 0 || message.payload.snapshot.key.trim().length === 0) throw new Error('ingest.payload.snapshot.bucket and key must be non-empty')
  if (message.payload.snapshot.sourceCommitSha.trim().length === 0) throw new Error('ingest.payload.snapshot.sourceCommitSha must be non-empty')

  const { parseOptions } = message.payload
  if (!Number.isFinite(parseOptions.maxFileBytes) || parseOptions.maxFileBytes <= 0) throw new Error('ingest.payload.parseOptions.maxFileBytes must be > 0')
  if (!Number.isFinite(parseOptions.maxSegmentChars) || parseOptions.maxSegmentChars <= 0) throw new Error('ingest.payload.parseOptions.maxSegmentChars must be > 0')
}
