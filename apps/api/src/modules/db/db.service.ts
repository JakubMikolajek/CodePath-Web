import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

@Injectable()
export class DbService implements OnModuleDestroy {
  get dbClient() {
    return this.db
  }
  private readonly pool = new Pool({ connectionString: 'postgres://postgres:postgres@192.168.1.245:5432/codepath' })

  private readonly db: NodePgDatabase = drizzle(this.pool)

  async onModuleDestroy() {
    await this.pool.end()
  }
}
