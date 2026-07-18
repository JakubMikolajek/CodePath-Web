import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Nullable, Undefinable } from '@workspace/codepath-common/globals'
import {
  INGEST_CONTRACT_VERSION_V2,
  type IngestJobRequestV2,
  IngestMessageType, IngestProducer,
  StorageProvider
} from '@workspace/codepath-common/ingest'
import { RepoEmbeddingStatus } from '@workspace/codepath-common/repository'
import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'
import crypto from 'crypto'
import { and, eq, lt } from 'drizzle-orm'
import { readdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises'
import { map } from 'lodash'
import NodeRSA from 'node-rsa'
import path from 'path'
import simpleGit, { type SimpleGit } from 'simple-git'

import { env } from '../../../config/env'
import { IGNORED_DIRS, IGNORED_EXTENSIONS, IGNORED_FILES } from '../../../utils/ignores'
import { files, InsertFile, repoDocsFragments, repos, SelectRepo } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { OrchestratorClient } from '../../orchestrator-client/services/orchestrator-client.service'
import { RepoStorageService } from '../../repo-storage/services/repo-storage.service'
import { emitTelemetry } from '../../telemetry/services/telemetry'
import { RepoAuthType } from '../dto/create-repo.dto'

interface CloneConfig {
  cloneUrl: string
  safeLogUrl: string
  secretsToMask: string[]
  sshPrivateKey: Nullable<string>
}

interface IngestFileDelta {
  changedFilePaths: string[]
  deletedFilePaths: string[]
}

interface TrackedFile {
  hash: Nullable<Undefinable<string>>
  path: string
}

const nowIso = () => new Date().toISOString()

@Injectable()
export class RepoFetcherService {
  private logger: Logger = new Logger(RepoFetcherService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly repoStorageService: RepoStorageService,
    private readonly orchestratorClient: OrchestratorClient,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async markStalePipelineStages() {
    const cutoff = new Date(Date.now() - env.pipelineStaleAfterMs).toISOString()

    const staleClones = await this.dbService.dbClient.update(repos).set({
      cloneStatus: 'failed',
      docsStatus: 'failed',
      embeddingStatus: RepoEmbeddingStatus.FAILED,
      lastPipelineError: `Clone stage exceeded ${env.pipelineStaleAfterMs}ms without completion`,
      pipelineUpdatedAt: nowIso()
    }).where(and(eq(repos.cloneStatus, 'cloning'), lt(repos.pipelineUpdatedAt, cutoff))).returning({ id: repos.id })

    const staleEmbeddings = await this.dbService.dbClient.update(repos).set({
      docsStatus: 'failed',
      embeddingStatus: RepoEmbeddingStatus.FAILED,
      lastPipelineError: `Embedding stage exceeded ${env.pipelineStaleAfterMs}ms without completion`,
      pipelineUpdatedAt: nowIso()
    }).where(and(eq(repos.embeddingStatus, RepoEmbeddingStatus.PROCESSING), lt(repos.pipelineUpdatedAt, cutoff))).returning({ id: repos.id })

    const staleDocs = await this.dbService.dbClient.update(repos).set({
      docsProgressMessage: `Documentation stage exceeded ${env.pipelineStaleAfterMs}ms without completion`,
      docsProgressStage: 'failed',
      docsProgressUpdatedAt: nowIso(),
      docsStatus: 'failed',
      lastPipelineError: `Documentation stage exceeded ${env.pipelineStaleAfterMs}ms without completion`,
      pipelineUpdatedAt: nowIso()
    }).where(and(eq(repos.docsStatus, 'processing'), lt(repos.pipelineUpdatedAt, cutoff))).returning({ id: repos.id })

    for (const repo of [...staleClones, ...staleEmbeddings, ...staleDocs]) {
      emitTelemetry({
        component: 'repo-fetcher.service',
        details: { staleAfterMs: env.pipelineStaleAfterMs },
        event: 'pipeline_stage_marked_stale',
        level: TelemetryLevel.WARN,
        repoId: repo.id,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForPending() {
    const [repoToClone] = await this.dbService.dbClient.select({ id: repos.id })
      .from(repos)
      .where(eq(repos.cloneStatus, 'pending'))
      .limit(1)

    if (!repoToClone) return

    const [claimedRepo] = await this.dbService.dbClient.update(repos).set({
      cloneStatus: 'cloning',
      lastPipelineError: null,
      pipelineUpdatedAt: nowIso()
    }).where(and(eq(repos.id, repoToClone.id), eq(repos.cloneStatus, 'pending'))).returning()

    if (!claimedRepo) return

    await this.cloneRepo(claimedRepo)
  }

  async requeueIngestJob(repo: SelectRepo) {
    const ingestMessage = this.buildIngestJobRequest(repo.id, repo.sourceCommitSha ?? '', {
      bucket: repo.storageBucket,
      key: repo.storageKey,
      provider: repo.storageProvider
    })

    await this.orchestratorClient.enqueueIngestJob(ingestMessage)

    emitTelemetry({
      component: 'repo-fetcher.service',
      details: {
        bucket: ingestMessage.payload.snapshot.bucket,
        key: ingestMessage.payload.snapshot.key
      },
      event: 'ingest_job_request_republished',
      level: TelemetryLevel.INFO,
      queueName: 'ingest',
      repoId: repo.id,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API,
      status: TelemetryStatus.OK
    })
  }

  private buildCloneConfig(repo: SelectRepo): CloneConfig {
    const legacySecret = this.trimOrNull(repo.accessKey)
    const configuredSecret = this.trimOrNull(repo.gitAuthSecret)
    const effectiveSecret = configuredSecret ?? legacySecret
    const configuredAuthType = (repo.gitAuthType ?? RepoAuthType.NONE) as RepoAuthType
    const effectiveAuthType = configuredAuthType === RepoAuthType.NONE && !configuredSecret && legacySecret ? RepoAuthType.SSH_KEY : configuredAuthType

    if (effectiveAuthType === RepoAuthType.NONE) {
      return {
        cloneUrl: repo.gitUrl,
        safeLogUrl: this.sanitizeAuthUrl(repo.gitUrl),
        secretsToMask: [legacySecret].filter(Boolean) as string[],
        sshPrivateKey: null
      }
    }

    if (!effectiveSecret) throw new Error('Git auth secret is required for private repository clone')

    if (effectiveAuthType === RepoAuthType.HTTPS_TOKEN) {
      const username = this.trimOrNull(repo.gitAuthUsername) ?? 'oauth2'
      const cloneUrl = this.buildHttpsAuthCloneUrl(repo.gitUrl, username, effectiveSecret)
      return {
        cloneUrl,
        safeLogUrl: this.sanitizeAuthUrl(cloneUrl),
        secretsToMask: [effectiveSecret],
        sshPrivateKey: null
      }
    }

    return {
      cloneUrl: repo.gitUrl,
      safeLogUrl: this.sanitizeAuthUrl(repo.gitUrl),
      secretsToMask: [effectiveSecret],
      sshPrivateKey: this.normalizeSshPrivateKey(effectiveSecret)
    }
  }

  private buildHttpsAuthCloneUrl(gitUrl: string, username: string, secret: string): string {
    const normalized = this.toHttpsRepoUrl(gitUrl)
    const parsed = new URL(normalized)
    parsed.username = username
    parsed.password = secret
    return parsed.toString()
  }

  private buildIngestJobRequest(
    repoId: number,
    commitSha: string,
    snapshot: { bucket: Nullable<string>, key: Nullable<string>, provider: 'local' | 'minio' },
    delta?: IngestFileDelta
  ): IngestJobRequestV2 {
    if (snapshot.provider !== 'minio' || !snapshot.bucket || !snapshot.key) throw new Error('Ingest contract requires MinIO snapshot location. Configure REPO_STORAGE_PROVIDER=minio and ensure snapshot upload succeeded.')

    return {
      contractVersion: INGEST_CONTRACT_VERSION_V2,
      correlationId: `ingest-${repoId}-${crypto.randomUUID()}`,
      messageType: IngestMessageType.JOB_REQUEST,
      payload: {
        ...(delta?.changedFilePaths.length ? { changedFilePaths: delta.changedFilePaths } : {}),
        ...(delta?.deletedFilePaths.length ? { deletedFilePaths: delta.deletedFilePaths } : {}),
        parseOptions: {
          includeConfigFiles: env.ingestIncludeConfigFiles,
          includeDocumentationFiles: env.ingestIncludeDocumentationFiles,
          maxFileBytes: env.ingestMaxFileBytes,
          maxSegmentChars: env.ingestMaxSegmentChars
        },
        snapshot: {
          bucket: snapshot.bucket,
          key: snapshot.key,
          provider: StorageProvider.MINIO,
          sourceCommitSha: commitSha
        }
      },
      producedAt: new Date().toISOString(),
      producer: IngestProducer.WEB_API,
      repoId
    }
  }

  private calculateIngestDelta(previousFiles: TrackedFile[], currentFiles: TrackedFile[]): IngestFileDelta {
    const previousFilesByPath = new Map(previousFiles.map(file => [file.path, file.hash]))
    const currentFilePaths = new Set(currentFiles.map(file => file.path))

    return {
      changedFilePaths: currentFiles
        .filter(file => !previousFilesByPath.has(file.path) || previousFilesByPath.get(file.path) !== file.hash)
        .map(file => file.path),
      deletedFilePaths: previousFiles
        .filter(file => !currentFilePaths.has(file.path))
        .map(file => file.path)
    }
  }

  private async cloneRepo(repo: SelectRepo): Promise<void> {
    const git = simpleGit()
    const targetPath = this.repoStorageService.getCloneWorkspacePath(repo.id, repo.name)

    let cloneConfig: CloneConfig = {
      cloneUrl: repo.gitUrl,
      safeLogUrl: this.sanitizeAuthUrl(repo.gitUrl),
      secretsToMask: [],
      sshPrivateKey: null
    }

    let tmpKeyPath: Nullable<string> = null
    const gitEnvBackup = process.env.GIT_SSH_COMMAND

    try {
      cloneConfig = this.buildCloneConfig(repo)
      this.logger.log(`Cloning: ${cloneConfig.safeLogUrl} -> ${targetPath}`)

      await this.repoStorageService.ensureLocalWorkspaceRoot()
      await rm(targetPath, { force: true, recursive: true })

      if (cloneConfig.sshPrivateKey) {
        tmpKeyPath = `/tmp/repo_${repo.id}_id_rsa`
        await writeFile(tmpKeyPath, cloneConfig.sshPrivateKey, { mode: 0o600 })
        process.env.GIT_SSH_COMMAND = `ssh -i ${tmpKeyPath} -o StrictHostKeyChecking=no`
      }

      const branchToClone = await this.resolveBranchToClone(git, cloneConfig.cloneUrl, repo.defaultBranch)
      if (branchToClone) {
        this.logger.log(`Branch selected for clone (${repo.name}): ${branchToClone}`)
        await git.clone(cloneConfig.cloneUrl, targetPath, ['--branch', branchToClone, '--single-branch'])
      } else {
        this.logger.log(`Branch selected for clone (${repo.name}): remote default`)
        await git.clone(cloneConfig.cloneUrl, targetPath)
      }

      const repoGit = simpleGit(targetPath)
      const checkedOutBranch = (await repoGit.revparse(['--abbrev-ref', 'HEAD'])).trim()
      const commitSha = (await repoGit.revparse(['HEAD'])).trim()
      const snapshot = await this.repoStorageService.persistSnapshot({ commitSha, repoId: repo.id, sourceDir: targetPath })

      await this.dbService.dbClient.update(repos).set({
        cloneStatus: 'cloned',
        defaultBranch: checkedOutBranch,
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
        path: targetPath,
        pipelineUpdatedAt: nowIso(),
        sourceCommitSha: commitSha,
        storageBucket: snapshot.bucket,
        storageKey: snapshot.key,
        storageProvider: snapshot.provider
      }).where(eq(repos.id, repo.id))
      await this.dbService.dbClient.delete(repoDocsFragments).where(eq(repoDocsFragments.repoId, repo.id))

      const previousFiles = await this.dbService.dbClient.select({
        hash: files.hash,
        path: files.path
      }).from(files).where(eq(files.repoId, repo.id))

      const filePaths = await this.getAllFiles(targetPath)
      const filesData = await Promise.all(
        map(filePaths, async (filePath): Promise<InsertFile & TrackedFile> => {
          const relPath = path.relative(targetPath, filePath)
          const stats = await stat(filePath)
          const hash = await this.hashFile(filePath)

          return { hash, lastModified: stats.mtime.toISOString(), path: relPath, repoId: repo.id }
        })
      )
      const ingestDelta = this.calculateIngestDelta(previousFiles, filesData)
      const deltaForIngest = previousFiles.length > 0 ? ingestDelta : undefined

      await this.dbService.dbClient.delete(files).where(eq(files.repoId, repo.id))
      await this.dbService.dbClient.insert(files).values(filesData)

      try {
        const ingestMessage = this.buildIngestJobRequest(repo.id, commitSha, snapshot, deltaForIngest)
        await this.orchestratorClient.enqueueIngestJob(ingestMessage)

        emitTelemetry({
          component: 'repo-fetcher.service',
          details: {
            bucket: ingestMessage.payload.snapshot.bucket,
            key: ingestMessage.payload.snapshot.key
          },
          event: 'ingest_job_request_published',
          level: TelemetryLevel.INFO,
          queueName: 'ingest',
          repoId: repo.id,
          runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
          service: TelemetryService.WEB_API,
          status: TelemetryStatus.OK
        })

        this.logger.log(`✓ Cloned, indexed, and queued ingest for ${repo.name}`)
      } catch (cause) {
        const safeCauseMessage = this.sanitizeErrorMessage(cause, cloneConfig.secretsToMask)

        await this.dbService.dbClient.update(repos).set({
          docsStatus: 'failed',
          embeddingStatus: RepoEmbeddingStatus.FAILED,
          lastPipelineError: safeCauseMessage,
          pipelineUpdatedAt: nowIso()
        }).where(eq(repos.id, repo.id))

        emitTelemetry({
          component: 'repo-fetcher.service',
          details: {
            errorMessage: safeCauseMessage,
            errorName: cause instanceof Error ? cause.name : 'UnknownError'
          },
          event: 'ingest_job_request_publish_failed',
          level: TelemetryLevel.ERROR,
          queueName: 'ingest',
          repoId: repo.id,
          runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
          service: TelemetryService.WEB_API,
          status: TelemetryStatus.ERROR
        })

        this.logger.error(`✗ Failed to enqueue ingest for ${repo.name}: ${safeCauseMessage}`)
      }
    } catch (error: unknown) {
      const safeErrorMessage = this.sanitizeErrorMessage(error, cloneConfig.secretsToMask)
      this.logger.error(`✗ Error cloning ${repo.name}: ${safeErrorMessage}`)

      await this.dbService.dbClient.update(repos).set({
        cloneStatus: 'failed',
        docsStatus: 'failed',
        embeddingStatus: RepoEmbeddingStatus.FAILED,
        lastPipelineError: safeErrorMessage,
        pipelineUpdatedAt: nowIso()
      }).where(eq(repos.id, repo.id))

      throw new Error(safeErrorMessage)
    } finally {
      if (tmpKeyPath) await unlink(tmpKeyPath).catch(() => { })

      if (gitEnvBackup === undefined) delete process.env.GIT_SSH_COMMAND
      else process.env.GIT_SSH_COMMAND = gitEnvBackup
    }
  }

  private async fetchRemoteBranches(git: SimpleGit, cloneUrl: string): Promise<Set<string>> {
    try {
      const output = await git.listRemote([cloneUrl, 'refs/heads/*'])
      const branches = new Set<string>()

      for (const line of output.split('\n')) {
        const match = line.match(/refs\/heads\/(.+)$/)

        if (match?.[1]) branches.add(match[1].trim())
      }

      return branches
    } catch {
      this.logger.warn('Could not list remote branches, resolver will rely on candidate order')
      return new Set()
    }
  }

  private async fetchRemoteDefaultBranch(git: SimpleGit, cloneUrl: string): Promise<Nullable<string>> {
    try {
      const output = await git.listRemote(['--symref', cloneUrl, 'HEAD'])
      const match = output.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/)
      return match?.[1]?.trim() || null
    } catch {
      this.logger.warn('Could not read remote default branch, fallback candidates will be used')
      return null
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const entryPath = path.resolve(dir, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          const subFiles = await this.getAllFiles(entryPath)
          files.push(...subFiles)
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (!IGNORED_EXTENSIONS.has(ext) && !IGNORED_FILES.has(entry.name)) files.push(entryPath)
      }
    }

    return files
  }

  private async hashFile(filePath: string): Promise<string> {
    const content = await readFile(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  private normalizeSshPrivateKey(secret: string): string {
    try {
      return new NodeRSA(secret).exportKey('openssh-private')
    } catch {
      return secret
    }
  }

  private async resolveBranchToClone(git: SimpleGit, cloneUrl: string, configuredBranch: Nullable<string>): Promise<Nullable<string>> {
    const remoteDefaultBranch = await this.fetchRemoteDefaultBranch(git, cloneUrl)
    const remoteBranches = await this.fetchRemoteBranches(git, cloneUrl)

    const candidates = [
      this.trimOrNull(configuredBranch),
      remoteDefaultBranch,
      'develop',
      'main',
      'master'
    ].filter((value): value is string => Boolean(value))

    const uniqueCandidates = [...new Set(candidates)]

    for (const candidate of uniqueCandidates) {
      if (remoteBranches.size === 0 || remoteBranches.has(candidate)) {
        this.logger.log(
          `Branch resolution: configured=${this.trimOrNull(configuredBranch) ?? 'none'} `
          + `remoteDefault=${remoteDefaultBranch ?? 'none'} selected=${candidate}`
        )
        return candidate
      }
    }

    if (remoteDefaultBranch) {
      this.logger.log(
        `Branch resolution fallback: configured=${this.trimOrNull(configuredBranch) ?? 'none'} `
        + `remoteDefault=${remoteDefaultBranch} selected=${remoteDefaultBranch}`
      )
    } else {
      this.logger.warn(
        `Branch resolution failed: configured=${this.trimOrNull(configuredBranch) ?? 'none'} `
        + 'remoteDefault=none selected=none'
      )
    }

    return remoteDefaultBranch
  }

  private sanitizeAuthUrl(url: string): string {
    try {
      const parsed = new URL(url)
      if (parsed.username || parsed.password) {
        parsed.username = '***'
        parsed.password = '***'
      }
      return parsed.toString()
    } catch {
      return url.replace(/https?:\/\/[^@\s]+@/g, 'https://***@')
    }
  }

  private sanitizeErrorMessage(error: unknown, secretsToMask: string[]): string {
    let message = error instanceof Error ? error.message : String(error)

    for (const secret of secretsToMask.filter(Boolean)) {
      message = message.split(secret).join('***')
    }

    return message.replace(/https?:\/\/[^@\s]+@/g, 'https://***@')
  }

  private toHttpsRepoUrl(gitUrl: string): string {
    if (gitUrl.startsWith('https://') || gitUrl.startsWith('http://')) return gitUrl

    const scpStyleMatch = gitUrl.match(/^git@([^:]+):(.+)$/)

    if (scpStyleMatch) {
      const [, host, repoPath] = scpStyleMatch
      return `https://${host}/${repoPath}`
    }

    if (gitUrl.startsWith('ssh://')) {
      const parsed = new URL(gitUrl)
      const repoPath = parsed.pathname.replace(/^\/+/, '')
      return `https://${parsed.hostname}/${repoPath}`
    }

    throw new Error('Unsupported git URL format for HTTPS token auth')
  }

  private trimOrNull(value: Nullable<Undefinable<string>>): Nullable<string> {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
}
