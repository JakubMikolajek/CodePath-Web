const DEFAULTS = {
  corsAllowedOrigins: '*',
  databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/codepath',
  jwtExpiresInSeconds: 7 * 24 * 60 * 60,
  jwtSecret: 'supersecret',
  port: 3001,
  orchestratorUrl: 'http://127.0.0.1:8080',
  qdrantHost: '127.0.0.1',
  qdrantPort: 6333,
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

export const env = {
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS, DEFAULTS.corsAllowedOrigins),
  databaseUrl: process.env.DATABASE_URL ?? DEFAULTS.databaseUrl,
  jwtExpiresInSeconds: parseInteger(
    process.env.JWT_EXPIRES_IN_SECONDS,
    parseInteger(process.env.JWT_EXPIRES_IN, DEFAULTS.jwtExpiresInSeconds)
  ),
  jwtSecret: process.env.JWT_SECRET ?? DEFAULTS.jwtSecret,
  port: parseInteger(process.env.PORT, DEFAULTS.port),
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? DEFAULTS.orchestratorUrl,
  qdrantHost: process.env.QDRANT_HOST ?? DEFAULTS.qdrantHost,
  qdrantPort: parseInteger(process.env.QDRANT_PORT, DEFAULTS.qdrantPort),
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
