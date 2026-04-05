const DEFAULTS = {
  corsAllowedOrigins: '*',
  databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/codepath',
  ingestIncludeConfigFiles: true,
  ingestIncludeDocumentationFiles: true,
  ingestMaxFileBytes: 5_000_000,
  ingestMaxSegmentChars: 4_000,
  jwtExpiresInSeconds: 7 * 24 * 60 * 60,
  jwtSecret: 'supersecret',
  port: 3001,
  orchestratorUrl: 'http://127.0.0.1:8080',
  qdrantHost: '127.0.0.1',
  qdrantPort: 6333,
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
  rabbitAllowDestructiveMigration: false,
  rabbitRetryDelayMs: 5000,
  rabbitUrl: 'amqp://admin:admin@127.0.0.1'
} as const

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return fallback
  }

  return parsed
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

function parseList(value: string | undefined, fallback: string): string[] {
  const source = value ?? fallback
  return source
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseStorageProvider(value: string | undefined): 'local' | 'minio' {
  const normalized = (value ?? DEFAULTS.repoStorageProvider).trim().toLowerCase()
  if (normalized === 'minio') {
    return 'minio'
  }
  return 'local'
}

export const env = {
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS, DEFAULTS.corsAllowedOrigins),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  ingestIncludeConfigFiles: parseBoolean(
    process.env.INGEST_INCLUDE_CONFIG_FILES,
    DEFAULTS.ingestIncludeConfigFiles
  ),
  ingestIncludeDocumentationFiles: parseBoolean(
    process.env.INGEST_INCLUDE_DOCUMENTATION_FILES,
    DEFAULTS.ingestIncludeDocumentationFiles
  ),
  ingestMaxFileBytes: parseInteger(
    process.env.INGEST_MAX_FILE_BYTES,
    DEFAULTS.ingestMaxFileBytes
  ),
  ingestMaxSegmentChars: parseInteger(
    process.env.INGEST_MAX_SEGMENT_CHARS,
    DEFAULTS.ingestMaxSegmentChars
  ),
  jwtExpiresInSeconds: parseInteger(
    process.env.JWT_EXPIRES_IN_SECONDS,
    parseInteger(process.env.JWT_EXPIRES_IN, DEFAULTS.jwtExpiresInSeconds)
  ),
  jwtSecret: process.env.JWT_SECRET ?? DEFAULTS.jwtSecret,
  port: parseInteger(process.env.PORT, DEFAULTS.port),
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? DEFAULTS.orchestratorUrl,
  qdrantHost: process.env.QDRANT_HOST ?? DEFAULTS.qdrantHost,
  qdrantPort: parseInteger(process.env.QDRANT_PORT, DEFAULTS.qdrantPort),
  repoStorageLocalPath: process.env.REPO_STORAGE_LOCAL_PATH ?? DEFAULTS.repoStorageLocalPath,
  repoStorageMinioAccessKey:
    process.env.REPO_STORAGE_MINIO_ACCESS_KEY ?? DEFAULTS.repoStorageMinioAccessKey,
  repoStorageMinioBucket: process.env.REPO_STORAGE_MINIO_BUCKET ?? DEFAULTS.repoStorageMinioBucket,
  repoStorageMinioEndpoint:
    process.env.REPO_STORAGE_MINIO_ENDPOINT ?? DEFAULTS.repoStorageMinioEndpoint,
  repoStorageMinioForcePathStyle: parseBoolean(
    process.env.REPO_STORAGE_MINIO_FORCE_PATH_STYLE,
    DEFAULTS.repoStorageMinioForcePathStyle
  ),
  repoStorageMinioPort: parseInteger(
    process.env.REPO_STORAGE_MINIO_PORT,
    DEFAULTS.repoStorageMinioPort
  ),
  repoStorageMinioRegion: process.env.REPO_STORAGE_MINIO_REGION ?? DEFAULTS.repoStorageMinioRegion,
  repoStorageMinioSecretKey:
    process.env.REPO_STORAGE_MINIO_SECRET_KEY ?? DEFAULTS.repoStorageMinioSecretKey,
  repoStorageMinioUseSsl: parseBoolean(
    process.env.REPO_STORAGE_MINIO_USE_SSL,
    DEFAULTS.repoStorageMinioUseSsl
  ),
  repoStorageProvider: parseStorageProvider(process.env.REPO_STORAGE_PROVIDER),
  rabbitAllowDestructiveMigration: parseBoolean(
    process.env.RABBIT_ALLOW_DESTRUCTIVE_MIGRATION,
    DEFAULTS.rabbitAllowDestructiveMigration
  ),
  rabbitRetryDelayMs: parseInteger(process.env.RABBIT_RETRY_DELAY_MS, DEFAULTS.rabbitRetryDelayMs),
  rabbitUrl: process.env.RABBIT_URL ?? DEFAULTS.rabbitUrl
}

export function resolveCorsOrigin(): string[] | true {
  return env.corsAllowedOrigins.includes('*') ? true : env.corsAllowedOrigins
}
