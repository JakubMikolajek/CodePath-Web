import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { pick } from 'lodash'

import { DbService } from '../db/db.service'
import { InsertRepo, repos } from '../db/schema'

@Injectable()
export class RepoService {
  constructor(
    private readonly dbService: DbService
  ) { }

  async createRepo(payload: InsertRepo) {
    const { name, gitUrl, accessKey, userId } = payload

    const createdRepo = await this.dbService.dbClient.insert(repos).values({
      name,
      gitUrl,
      accessKey,
      userId,
    }).returning()

    return { newRepo: pick(createdRepo, ['id', 'name', 'cloneStatus']) }
  }

  async getUserRepos(userId: number) {
    const userRepos = await this.dbService.dbClient.select({
      name: repos.name,
      cloneStatus: repos.cloneStatus,
      id: repos.id,
    })
      .from(repos)
      .where(eq(repos.userId, userId))

    return userRepos
  }
}
