import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig
} from '@workspace/codepath-common/api-explorer'
import { and, desc, eq } from 'drizzle-orm'

import { apiRunnerCollections } from '../../db/schema'
import { DbService } from '../../db/services/db.service'

@Injectable()
export class ApiRunnerCollectionsRepository {
  constructor(private readonly dbService: DbService) {}

  async delete(userId: number, repoId: number, collectionId: number) {
    const [deleted] = await this.dbService.dbClient.delete(apiRunnerCollections)
      .where(and(
        eq(apiRunnerCollections.id, collectionId),
        eq(apiRunnerCollections.repoId, repoId),
        eq(apiRunnerCollections.userId, userId)
      ))
      .returning({ id: apiRunnerCollections.id })

    if (!deleted) {
      throw new NotFoundException('Runner collection not found')
    }

    return {
      id: deleted.id,
      ok: true as const
    }
  }

  async list(userId: number, repoId: number): Promise<RepoApiRunnerCollection[]> {
    const rows = await this.dbService.dbClient.select({
      config: apiRunnerCollections.config,
      createdAt: apiRunnerCollections.createdAt,
      id: apiRunnerCollections.id,
      name: apiRunnerCollections.name,
      updatedAt: apiRunnerCollections.updatedAt
    })
      .from(apiRunnerCollections)
      .where(and(
        eq(apiRunnerCollections.repoId, repoId),
        eq(apiRunnerCollections.userId, userId)
      ))
      .orderBy(desc(apiRunnerCollections.updatedAt))

    return rows.map(row => ({
      config: row.config,
      createdAt: row.createdAt,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt
    }))
  }

  async save(
    userId: number,
    repoId: number,
    name: string,
    config: RepoApiRunnerCollectionConfig
  ): Promise<RepoApiRunnerCollection> {
    const [saved] = await this.dbService.dbClient.insert(apiRunnerCollections)
      .values({
        config,
        name,
        repoId,
        userId
      })
      .onConflictDoUpdate({
        set: {
          config,
          updatedAt: new Date().toISOString()
        },
        target: [
          apiRunnerCollections.repoId,
          apiRunnerCollections.userId,
          apiRunnerCollections.name
        ]
      })
      .returning({
        config: apiRunnerCollections.config,
        createdAt: apiRunnerCollections.createdAt,
        id: apiRunnerCollections.id,
        name: apiRunnerCollections.name,
        updatedAt: apiRunnerCollections.updatedAt
      })

    return {
      config: saved.config,
      createdAt: saved.createdAt,
      id: saved.id,
      name: saved.name,
      updatedAt: saved.updatedAt
    }
  }
}
