import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import { map } from 'lodash'

import { DbService } from '../db/db.service'
import { dependencies, repos } from '../db/schema'

@Injectable()
export class DependenciesService {
  private logger: Logger = new Logger(DependenciesService.name)

  constructor(
    private readonly dbService: DbService
  ) { }

  async getRepoDependencies(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      id: repos.id
    })
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) {
      throw new NotFoundException('Repository not found')
    }

    const allDependencies = await this.dbService.dbClient.select()
      .from(dependencies)
      .where(eq(dependencies.repoId, repoId))
      .orderBy(desc(dependencies.createdAt))

    return map(allDependencies, dependency => ({
      fileId: dependency.fileId,
      fileName: dependency.fileName,
      graph: dependency.graph,
      id: dependency.id
    }))
  }
}
