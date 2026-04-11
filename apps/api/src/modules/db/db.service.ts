import { existsSync } from 'node:fs'
import path from 'node:path'

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { env } from '../../config/env'

@Injectable()
export class DbService implements OnModuleDestroy, OnModuleInit {
  get dbClient() {
    return this.db
  }
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
    this.logger.log(`Running Drizzle migrations from ${migrationsFolder}`)
    await migrate(this.db, { migrationsFolder })
    this.logger.log('Drizzle migrations completed')
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
    if (!folder) {
      throw new Error(`Drizzle migrations folder not found. Checked: ${candidates.join(', ')}`)
    }

    return folder
  }
}
