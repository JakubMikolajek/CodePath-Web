const DEFAULTS = {
  authProvider: 'keycloak',
  corsAllowedOrigins: '*',
  databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/codepath',
  ingestIncludeConfigFiles: true,
  ingestIncludeDocumentationFiles: true,
  ingestMaxFileBytes: 5_000_000,
  ingestMaxSegmentChars: 4_000,
  jwtExpiresInSeconds: 7 * 24 * 60 * 60,
  jwtSecret: 'supersecret',
  keycloakAdminClientId: 'admin-cli',
  keycloakAdminPassword: 'admin',
  keycloakAdminRealm: 'master',
  keycloakAdminUsername: 'admin',
  keycloakBaseUrl: 'http://127.0.0.1:8081',
  keycloakClientId: 'codepath-web',
  keycloakClientSecret: '',
  keycloakRealm: 'codepath-local',
  orchestratorTimeoutMs: 60_000,
  orchestratorUrl: 'http://127.0.0.1:8080',
  port: 3001,
  qdrantHost: '127.0.0.1',
  qdrantPort: 6333,
  rabbitAllowDestructiveMigration: false,
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
  repoStorageProvider: 'minio'
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

function parseAuthProvider(value: string | undefined): 'hybrid' | 'keycloak' | 'local' {
  const normalized = (value ?? DEFAULTS.authProvider).trim().toLowerCase()
  if (normalized === 'keycloak') {
    return 'keycloak'
  }
  if (normalized === 'hybrid') {
    return 'hybrid'
  }
  return 'local'
}

export const env = {
  authProvider: parseAuthProvider(process.env.AUTH_PROVIDER),
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
  keycloakAdminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? DEFAULTS.keycloakAdminClientId,
  keycloakAdminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD ?? DEFAULTS.keycloakAdminPassword,
  keycloakAdminRealm: process.env.KEYCLOAK_ADMIN_REALM ?? DEFAULTS.keycloakAdminRealm,
  keycloakAdminUsername: process.env.KEYCLOAK_ADMIN_USERNAME ?? DEFAULTS.keycloakAdminUsername,
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL ?? DEFAULTS.keycloakBaseUrl,
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID ?? DEFAULTS.keycloakClientId,
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? DEFAULTS.keycloakClientSecret,
  keycloakRealm: process.env.KEYCLOAK_REALM ?? DEFAULTS.keycloakRealm,
  orchestratorTimeoutMs: parseInteger(
    process.env.ORCHESTRATOR_TIMEOUT_MS,
    DEFAULTS.orchestratorTimeoutMs
  ),
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? DEFAULTS.orchestratorUrl,
  port: parseInteger(process.env.PORT, DEFAULTS.port),
  qdrantHost: process.env.QDRANT_HOST ?? DEFAULTS.qdrantHost,
  qdrantPort: parseInteger(process.env.QDRANT_PORT, DEFAULTS.qdrantPort),
  rabbitAllowDestructiveMigration: parseBoolean(
    process.env.RABBIT_ALLOW_DESTRUCTIVE_MIGRATION,
    DEFAULTS.rabbitAllowDestructiveMigration
  ),
  rabbitRetryDelayMs: parseInteger(process.env.RABBIT_RETRY_DELAY_MS, DEFAULTS.rabbitRetryDelayMs),
  rabbitUrl: process.env.RABBIT_URL ?? DEFAULTS.rabbitUrl,
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
  repoStorageProvider: parseStorageProvider(process.env.REPO_STORAGE_PROVIDER)
}

export function resolveCorsOrigin(): string[] | true {
  return env.corsAllowedOrigins.includes('*') ? true : env.corsAllowedOrigins
}
