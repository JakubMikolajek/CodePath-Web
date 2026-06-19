import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common/globals'
import { RepoEmbeddingStatus } from '@workspace/codepath-common/repository'
import { and, eq } from 'drizzle-orm'
import { pick } from 'lodash'

import { env } from '../../../config/env'
import { repoDocsFragments, repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { RepoAuthType } from '../dto/create-repo.dto'
import { RepoFetcherService } from './repo-fetcher.service'

const nowIso = () => new Date().toISOString()

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
    private readonly dbService: DbService,
    private readonly repoFetcherService?: RepoFetcherService
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

    return pick(createdRepo, ['id', 'name', 'cloneStatus', 'embeddingStatus', 'docsStatus', 'pipelineUpdatedAt', 'lastPipelineError'])
  }

  async getUserRepos(userId: number) {
    const userRepos = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id,
      lastPipelineError: repos.lastPipelineError,
      name: repos.name,
      pipelineUpdatedAt: repos.pipelineUpdatedAt
    }).from(repos).where(eq(repos.userId, userId))

    return userRepos
  }

  async retryClonePipeline(userId: number, repoId: number) {
    const repo = await this.findUserRepo(userId, repoId)

    if (repo.cloneStatus === 'cloning') throw new ConflictException('Repository clone is already running')

    const [updatedRepo] = await this.dbService.dbClient.update(repos).set({
      cloneStatus: 'pending',
      docsProgressCurrent: null,
      docsProgressMessage: null,
      docsProgressModuleKey: null,
      docsProgressScope: null,
      docsProgressSectionKey: null,
      docsProgressStage: null,
      docsProgressTotal: null,
      docsProgressUpdatedAt: null,
      docsStatus: 'pending',
      documentation: null,
      embeddingStatus: RepoEmbeddingStatus.PENDING,
      lastPipelineError: null,
      path: null,
      pipelineUpdatedAt: nowIso(),
      sourceCommitSha: null,
      storageBucket: null,
      storageKey: null
    }).where(and(eq(repos.id, repoId), eq(repos.userId, userId))).returning()
    await this.dbService.dbClient.delete(repoDocsFragments).where(eq(repoDocsFragments.repoId, repoId))

    return this.toPipelineStatus(updatedRepo)
  }

  async retryIngestPipeline(userId: number, repoId: number) {
    const repo = await this.findUserRepo(userId, repoId)

    if (repo.cloneStatus !== 'cloned') throw new ConflictException(`Repository clone is not ready for ingest retry (cloneStatus=${repo.cloneStatus})`)

    if (
      repo.storageProvider !== 'minio'
      || !repo.storageBucket
      || !repo.storageKey
      || !repo.sourceCommitSha
    ) {
      throw new ConflictException('Repository snapshot is unavailable; restart clone first')
    }

    await this.dbService.dbClient.update(repos).set({
      docsProgressCurrent: null,
      docsProgressMessage: null,
      docsProgressModuleKey: null,
      docsProgressScope: null,
      docsProgressSectionKey: null,
      docsProgressStage: null,
      docsProgressTotal: null,
      docsProgressUpdatedAt: null,
      docsStatus: 'pending',
      documentation: null,
      embeddingStatus: RepoEmbeddingStatus.PROCESSING,
      lastPipelineError: null,
      pipelineUpdatedAt: nowIso()
    }).where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
    await this.dbService.dbClient.delete(repoDocsFragments).where(eq(repoDocsFragments.repoId, repoId))

    try {
      if (!this.repoFetcherService) throw new Error('Repo fetcher service is unavailable')

      await this.repoFetcherService.requeueIngestJob(repo)
    } catch (error) {
      await this.dbService.dbClient.update(repos).set({
        docsStatus: 'failed',
        embeddingStatus: RepoEmbeddingStatus.FAILED,
        lastPipelineError: error instanceof Error ? error.message : 'Failed to enqueue ingest retry',
        pipelineUpdatedAt: nowIso()
      }).where(and(eq(repos.id, repoId), eq(repos.userId, userId)))

      throw new ServiceUnavailableException(error instanceof Error ? error.message : 'Failed to enqueue ingest retry')
    }

    return {
      cloneStatus: repo.cloneStatus,
      docsStatus: 'pending',
      embeddingStatus: RepoEmbeddingStatus.PROCESSING,
      id: repo.id,
      lastPipelineError: null,
      pipelineUpdatedAt: nowIso()
    }
  }

  private async findUserRepo(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select().from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    return repo
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

    if (requestedAuthType === RepoAuthType.NONE) {
      return {
        accessKey: legacyAccessKey,
        gitAuthSecret: null,
        gitAuthType: RepoAuthType.NONE,
        gitAuthUsername: null
      }
    }

    if (!effectiveSecret) throw new BadRequestException('Auth secret is required for selected auth type')

    if (requestedAuthType === RepoAuthType.HTTPS_TOKEN) {
      return {
        accessKey: legacyAccessKey,
        gitAuthSecret: effectiveSecret,
        gitAuthType: RepoAuthType.HTTPS_TOKEN,
        gitAuthUsername: payload.authUsername?.trim() || 'oauth2'
      }
    }

    return {
      accessKey: legacyAccessKey ?? effectiveSecret,
      gitAuthSecret: effectiveSecret,
      gitAuthType: RepoAuthType.SSH_KEY,
      gitAuthUsername: payload.authUsername?.trim() || null
    }
  }

  private toPipelineStatus(repo: typeof repos.$inferSelect) {
    return pick(repo, ['id', 'cloneStatus', 'embeddingStatus', 'docsStatus', 'pipelineUpdatedAt', 'lastPipelineError'])
  }
}
