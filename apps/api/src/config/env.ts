import type { Undefinable } from '@workspace/codepath-common/globals'

const DEFAULTS = {
  corsAllowedOrigins: '*',
  databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/codepath',
  dbAutoMigrate: true,
  ingestIncludeConfigFiles: true,
  ingestIncludeDocumentationFiles: true,
  ingestMaxFileBytes: 5_000_000,
  ingestMaxSegmentChars: 8_000,
  keycloakAllowedAudiences: '',
  keycloakClientId: 'codepath-web',
  keycloakIssuer: 'http://127.0.0.1:8081/realms/codepath-local',
  orchestratorTimeoutMs: 60_000,
  orchestratorUrl: 'http://127.0.0.1:8080',
  pipelineStaleAfterMs: 30 * 60 * 1000,
  port: 3001,
  qdrantEmbeddingsCollectionName: 'embeddings_embeddinggemma',
  qdrantHost: '127.0.0.1',
  qdrantPort: 6333,
  rabbitAllowDestructiveMigration: false,
  rabbitManagementUrl: 'http://127.0.0.1:15672',
  rabbitRetryDelayMs: 5000,
  rabbitUrl: 'amqp://admin:admin@127.0.0.1',
  repoStorageLocalPath: 'storage/repos',
  repoStorageMinioAccessKey: 'minioadmin',
  repoStorageMinioBucket: 'codepath-repos',
  repoStorageMinioEndpoint: '127.0.0.1',
  repoStorageMinioForcePathStyle: true,
  repoStorageMinioPort: 9000,
  repoStorageMinioRegion: 'us-east-1',
  repoStorageMinioSecretKey: 'minioadmin',
  repoStorageMinioUseSsl: false,
  repoStorageProvider: 'minio',
  systemStatusTimeoutMs: 2500
} as const

function parseInteger(value: Undefinable<string>, fallback: number): number {
  if (!value) return fallback

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) return fallback

  return parsed
}

function parseBoolean(value: Undefinable<string>, fallback: boolean): boolean {
  if (!value) return fallback

  const normalized = value.trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false

  return fallback
}

function parseList(value: Undefinable<string>, fallback: string): string[] {
  const source = value ?? fallback
  return source.split(',').map(item => item.trim()).filter(Boolean)
}

function parseStorageProvider(value: Undefinable<string>): 'local' | 'minio' {
  const normalized = (value ?? DEFAULTS.repoStorageProvider).trim().toLowerCase()

  if (normalized === 'minio') return 'minio'

  return 'local'
}

export const env = {
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS, DEFAULTS.corsAllowedOrigins),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  dbAutoMigrate: parseBoolean(process.env.DB_AUTO_MIGRATE, DEFAULTS.dbAutoMigrate),
  ingestIncludeConfigFiles: parseBoolean(process.env.INGEST_INCLUDE_CONFIG_FILES, DEFAULTS.ingestIncludeConfigFiles),
  ingestIncludeDocumentationFiles: parseBoolean(process.env.INGEST_INCLUDE_DOCUMENTATION_FILES, DEFAULTS.ingestIncludeDocumentationFiles),
  ingestMaxFileBytes: parseInteger(process.env.INGEST_MAX_FILE_BYTES, DEFAULTS.ingestMaxFileBytes),
  ingestMaxSegmentChars: parseInteger(process.env.INGEST_MAX_SEGMENT_CHARS, DEFAULTS.ingestMaxSegmentChars),
  keycloakAllowedAudiences: parseList(process.env.KEYCLOAK_ALLOWED_AUDIENCES, DEFAULTS.keycloakAllowedAudiences),
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID ?? DEFAULTS.keycloakClientId,
  keycloakIssuer: process.env.KEYCLOAK_ISSUER ?? DEFAULTS.keycloakIssuer,
  orchestratorTimeoutMs: parseInteger(process.env.ORCHESTRATOR_TIMEOUT_MS, DEFAULTS.orchestratorTimeoutMs),
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? DEFAULTS.orchestratorUrl,
  pipelineStaleAfterMs: parseInteger(process.env.PIPELINE_STALE_AFTER_MS, DEFAULTS.pipelineStaleAfterMs),
  port: parseInteger(process.env.PORT, DEFAULTS.port),
  qdrantEmbeddingsCollectionName: process.env.QDRANT_EMBEDDINGS_COLLECTION_NAME ?? DEFAULTS.qdrantEmbeddingsCollectionName,
  qdrantHost: process.env.QDRANT_HOST ?? DEFAULTS.qdrantHost,
  qdrantPort: parseInteger(process.env.QDRANT_PORT, DEFAULTS.qdrantPort),
  rabbitAllowDestructiveMigration: parseBoolean(process.env.RABBIT_ALLOW_DESTRUCTIVE_MIGRATION, DEFAULTS.rabbitAllowDestructiveMigration),
  rabbitManagementUrl: process.env.RABBIT_MANAGEMENT_URL ?? DEFAULTS.rabbitManagementUrl,
  rabbitRetryDelayMs: parseInteger(process.env.RABBIT_RETRY_DELAY_MS, DEFAULTS.rabbitRetryDelayMs),
  rabbitUrl: process.env.RABBIT_URL ?? DEFAULTS.rabbitUrl,
  repoStorageLocalPath: process.env.REPO_STORAGE_LOCAL_PATH ?? DEFAULTS.repoStorageLocalPath,
  repoStorageMinioAccessKey: process.env.REPO_STORAGE_MINIO_ACCESS_KEY ?? DEFAULTS.repoStorageMinioAccessKey,
  repoStorageMinioBucket: process.env.REPO_STORAGE_MINIO_BUCKET ?? DEFAULTS.repoStorageMinioBucket,
  repoStorageMinioEndpoint: process.env.REPO_STORAGE_MINIO_ENDPOINT ?? DEFAULTS.repoStorageMinioEndpoint,
  repoStorageMinioForcePathStyle: parseBoolean(process.env.REPO_STORAGE_MINIO_FORCE_PATH_STYLE, DEFAULTS.repoStorageMinioForcePathStyle),
  repoStorageMinioPort: parseInteger(process.env.REPO_STORAGE_MINIO_PORT, DEFAULTS.repoStorageMinioPort),
  repoStorageMinioRegion: process.env.REPO_STORAGE_MINIO_REGION ?? DEFAULTS.repoStorageMinioRegion,
  repoStorageMinioSecretKey: process.env.REPO_STORAGE_MINIO_SECRET_KEY ?? DEFAULTS.repoStorageMinioSecretKey,
  repoStorageMinioUseSsl: parseBoolean(process.env.REPO_STORAGE_MINIO_USE_SSL, DEFAULTS.repoStorageMinioUseSsl),
  repoStorageProvider: parseStorageProvider(process.env.REPO_STORAGE_PROVIDER),
  systemStatusTimeoutMs: parseInteger(process.env.SYSTEM_STATUS_TIMEOUT_MS, DEFAULTS.systemStatusTimeoutMs)
}

export function resolveCorsOrigin(): string[] | true {
  return env.corsAllowedOrigins.includes('*') ? true : env.corsAllowedOrigins
}
