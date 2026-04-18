import { BadRequestException, Injectable } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common/globals'
import { eq } from 'drizzle-orm'
import { pick } from 'lodash'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import { repos } from '../db/schema'
import type { RepoAuthType } from './dto/create-repo.dto'

interface CreateRepoPayload {
  accessKey?: string
  authSecret?: string
  authType?: RepoAuthType
  authUsername?: string
  branch?: string
  gitUrl: string
  name: string
  userId: number
}

@Injectable()
export class RepoService {
  constructor(
    private readonly dbService: DbService
  ) { }

  async createRepo(payload: CreateRepoPayload) {
    const { gitUrl, name, userId } = payload
    const defaultBranch = payload.branch?.trim() || null
    const authConfig = this.resolveAuthConfig(payload)

    const [createdRepo] = await this.dbService.dbClient.insert(repos).values({
      accessKey: authConfig.accessKey,
      defaultBranch,
      gitAuthSecret: authConfig.gitAuthSecret,
      gitAuthType: authConfig.gitAuthType,
      gitAuthUsername: authConfig.gitAuthUsername,
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

  private resolveAuthConfig(payload: CreateRepoPayload): {
    accessKey: Nullable<string>
    gitAuthSecret: Nullable<string>
    gitAuthType: RepoAuthType
    gitAuthUsername: Nullable<string>
  } {
    const legacyAccessKey = payload.accessKey?.trim() || null
    const providedSecret = payload.authSecret?.trim() || null
    const effectiveSecret = providedSecret ?? legacyAccessKey
    const requestedAuthType = payload.authType ?? (effectiveSecret ? 'ssh_key' : 'none')

    if (requestedAuthType === 'none') {
      return {
        accessKey: legacyAccessKey,
        gitAuthSecret: null,
        gitAuthType: 'none',
        gitAuthUsername: null
      }
    }

    if (!effectiveSecret) {
      throw new BadRequestException('Auth secret is required for selected auth type')
    }

    if (requestedAuthType === 'https_token') {
      return {
        accessKey: legacyAccessKey,
        gitAuthSecret: effectiveSecret,
        gitAuthType: 'https_token',
        gitAuthUsername: payload.authUsername?.trim() || 'oauth2'
      }
    }

    return {
      accessKey: legacyAccessKey ?? effectiveSecret,
      gitAuthSecret: effectiveSecret,
      gitAuthType: 'ssh_key',
      gitAuthUsername: payload.authUsername?.trim() || null
    }
  }
}
