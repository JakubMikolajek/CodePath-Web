import { Injectable, Logger } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { map } from 'lodash'

import { DbService } from '../db/db.service'
import { dependencies } from '../db/schema'

@Injectable()
export class DependenciesService {
  private logger: Logger = new Logger(DependenciesService.name)

  constructor(
    private readonly dbService: DbService
  ) { }

  async getRepoDependencies(repoId: number) {
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
