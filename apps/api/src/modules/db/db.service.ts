import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { env } from '../../config/env'

@Injectable()
export class DbService implements OnModuleDestroy {
  get dbClient() {
    return this.db
  }
  private readonly pool = new Pool({ connectionString: env.databaseUrl })

  private readonly db: NodePgDatabase = drizzle(this.pool)

  async onModuleDestroy() {
    await this.pool.end()
  }
}
