import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  RepoApiRunnerAuthConfig,
  RepoApiRunnerAuthPreset
} from '@workspace/codepath-common/api-explorer'
import { and, desc, eq } from 'drizzle-orm'

import { apiRunnerAuthPresets } from '../../db/schema'
import { DbService } from '../../db/services/db.service'

@Injectable()
export class ApiRunnerAuthPresetsRepository {
  constructor(private readonly dbService: DbService) {}

  async delete(userId: number, repoId: number, presetId: number) {
    const [deleted] = await this.dbService.dbClient.delete(apiRunnerAuthPresets)
      .where(and(
        eq(apiRunnerAuthPresets.id, presetId),
        eq(apiRunnerAuthPresets.repoId, repoId),
        eq(apiRunnerAuthPresets.userId, userId)
      ))
      .returning({ id: apiRunnerAuthPresets.id })

    if (!deleted) throw new NotFoundException('Runner auth preset not found')

    return { id: deleted.id, ok: true as const }
  }

  async list(userId: number, repoId: number): Promise<RepoApiRunnerAuthPreset[]> {
    const rows = await this.dbService.dbClient.select({
      config: apiRunnerAuthPresets.config,
      createdAt: apiRunnerAuthPresets.createdAt,
      id: apiRunnerAuthPresets.id,
      name: apiRunnerAuthPresets.name,
      updatedAt: apiRunnerAuthPresets.updatedAt
    })
      .from(apiRunnerAuthPresets)
      .where(and(
        eq(apiRunnerAuthPresets.repoId, repoId),
        eq(apiRunnerAuthPresets.userId, userId)
      ))
      .orderBy(desc(apiRunnerAuthPresets.updatedAt))

    return rows.map(row => ({
      config: row.config,
      createdAt: row.createdAt,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt
    }))
  }

  async save(userId: number, repoId: number, name: string, config: RepoApiRunnerAuthConfig): Promise<RepoApiRunnerAuthPreset> {
    const [saved] = await this.dbService.dbClient.insert(apiRunnerAuthPresets).values({
      config,
      name,
      repoId,
      userId
    }).onConflictDoUpdate({
      set: { config, updatedAt: new Date().toISOString() },
      target: [apiRunnerAuthPresets.repoId, apiRunnerAuthPresets.userId, apiRunnerAuthPresets.name]
    }).returning({
      config: apiRunnerAuthPresets.config,
      createdAt: apiRunnerAuthPresets.createdAt,
      id: apiRunnerAuthPresets.id,
      name: apiRunnerAuthPresets.name,
      updatedAt: apiRunnerAuthPresets.updatedAt
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
