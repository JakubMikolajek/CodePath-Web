import { existsSync } from 'node:fs'
import path from 'node:path'

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { env } from '../../../config/env'

// Tables that must exist for us to conclude this is a legacy DB (schema present, no Drizzle history).
// Without this check, calling migrate() on a legacy DB crashes on migration 0000 because
// the types and tables already exist and Postgres rejects the CREATE statements.
const LEGACY_REQUIRED_TABLES = ['users', 'repos', 'files', 'dependencies'] as const

type LegacyTableName = (typeof LEGACY_REQUIRED_TABLES)[number]

export function shouldBootstrapLegacyMigrationBaseline(hasMigrationHistory: boolean, tablePresenceByName: Record<LegacyTableName, boolean>): boolean {
  if (hasMigrationHistory) return false

  return LEGACY_REQUIRED_TABLES.every(tableName => tablePresenceByName[tableName] === true)
}

@Injectable()
export class DbService implements OnModuleDestroy, OnModuleInit {
  get dbClient() { return this.db }
  private readonly pool = new Pool({ connectionString: env.databaseUrl })
  private readonly db: NodePgDatabase = drizzle(this.pool)

  private readonly logger = new Logger(DbService.name)

  async onModuleDestroy() {
    await this.pool.end()
  }

  async onModuleInit() {
    if (!env.dbAutoMigrate) {
      this.logger.log('DB_AUTO_MIGRATE=false, skipping startup migrations')
      return
    }

    const migrationsFolder = this.resolveMigrationsFolder()
    const baselinedLegacySchema = await this.bootstrapLegacyMigrationBaselineIfNeeded(migrationsFolder)

    if (baselinedLegacySchema) {
      await this.applyRepoAuthSchemaCompatPatch()
      await this.applyUserIdentitySchemaCompatPatch()
    }

    this.logger.log(`Running Drizzle migrations from ${migrationsFolder}`)
    await migrate(this.db, { migrationsFolder })
    this.logger.log('Drizzle migrations completed')
  }

  // Idempotent patch for legacy repos rows that predate the git auth migration.
  // Copies access_key → git_auth_secret for SSH-key repos so the new auth model works
  // on existing data without a destructive migration.
  private async applyRepoAuthSchemaCompatPatch(): Promise<void> {
    await this.pool.query(`
      DO $$
      BEGIN
        CREATE TYPE "repo_git_auth_type" AS ENUM ('none', 'https_token', 'ssh_key');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await this.pool.query(`
      ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "default_branch" text;
      ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "git_auth_type" "repo_git_auth_type" DEFAULT 'none' NOT NULL;
      ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "git_auth_username" text;
      ALTER TABLE "repos" ADD COLUMN IF NOT EXISTS "git_auth_secret" text;
    `)

    await this.pool.query(`
      UPDATE "repos"
      SET
        "git_auth_type" = 'ssh_key',
        "git_auth_secret" = "access_key"
      WHERE
        COALESCE(trim("git_auth_secret"), '') = ''
        AND COALESCE(trim("access_key"), '') <> '';
    `)

    this.logger.log('Applied legacy repo auth schema compatibility patch')
  }

  private async applyUserIdentitySchemaCompatPatch(): Promise<void> {
    await this.pool.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" text DEFAULT 'local' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_subject" text;
    `)

    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_auth_provider_subject_key"
      ON "users" ("auth_provider","auth_subject")
      WHERE "auth_subject" IS NOT NULL;
    `)

    this.logger.log('Applied legacy user identity schema compatibility patch')
  }

  // Inserts the latest migration hash into drizzle.__drizzle_migrations so that Drizzle
  // treats the existing legacy schema as already applied and only runs genuinely new migrations.
  // Returns true when a baseline was inserted so the caller can apply compat patches before migrate().
  private async bootstrapLegacyMigrationBaselineIfNeeded(migrationsFolder: string): Promise<boolean> {
    await this.pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `)

    const migrationCountResult = await this.pool.query<{ count: string }>('select count(*)::int as count from drizzle.__drizzle_migrations')
    const hasMigrationHistory = Number(migrationCountResult.rows[0]?.count ?? 0) > 0
    const tablePresenceByName = await this.getLegacyTablePresence()
    const shouldBootstrap = shouldBootstrapLegacyMigrationBaseline(hasMigrationHistory, tablePresenceByName)

    if (!shouldBootstrap) return false

    const migrations = readMigrationFiles({ migrationsFolder })
    const latestMigration = migrations.at(-1)

    if (!latestMigration) {
      this.logger.warn(`No migrations found in ${migrationsFolder}; skipping legacy baseline`)
      return false
    }

    await this.pool.query(
      'insert into drizzle.__drizzle_migrations ("hash", "created_at") values ($1, $2)',
      [latestMigration.hash, latestMigration.folderMillis]
    )

    this.logger.warn('Legacy DB schema detected without drizzle history; migration baseline inserted')
    return true
  }

  private async getLegacyTablePresence(): Promise<Record<LegacyTableName, boolean>> {
    const presence = {
      dependencies: false,
      files: false,
      repos: false,
      users: false
    } as Record<LegacyTableName, boolean>

    for (const tableName of LEGACY_REQUIRED_TABLES) {
      const result = await this.pool.query<{ regclass: Nullable<string> }>('select to_regclass($1) as regclass', [`public.${tableName}`])

      presence[tableName] = Boolean(result.rows[0]?.regclass)
    }

    return presence
  }

  private resolveMigrationsFolder(): string {
    const cwd = process.cwd()
    const candidates = [
      path.resolve(cwd, 'src/drizzle'),
      path.resolve(cwd, 'dist/drizzle'),
      path.resolve(cwd, 'apps/api/src/drizzle'),
      path.resolve(cwd, 'apps/api/dist/drizzle')
    ]

    const folder = candidates.find(candidate => existsSync(candidate))

    if (!folder) throw new Error(`Drizzle migrations folder not found. Checked: ${candidates.join(', ')}`)

    return folder
  }
}
