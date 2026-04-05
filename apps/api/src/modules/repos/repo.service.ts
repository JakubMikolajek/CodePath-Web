import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { pick } from 'lodash'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import { InsertRepo, repos } from '../db/schema'

@Injectable()
export class RepoService {
  constructor(
    private readonly dbService: DbService
  ) { }

  async createRepo(payload: InsertRepo) {
    const { accessKey, gitUrl, name, userId } = payload

    const [createdRepo] = await this.dbService.dbClient.insert(repos).values({
      accessKey,
      gitUrl,
      name,
      storageProvider: env.repoStorageProvider,
      userId
    }).returning()

    return pick(createdRepo, ['id', 'name', 'cloneStatus', 'embeddingStatus', 'docsStatus'])
  }

  async getUserRepos(userId: number) {
    const userRepos = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id,
      name: repos.name
    })
      .from(repos)
      .where(eq(repos.userId, userId))

    return userRepos
  }
}
