import { URL } from 'node:url'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Nullable } from '@workspace/codepath-common/globals'
import type { IngestJobRequestV1 } from '@workspace/codepath-common/ingest'
import crypto from 'crypto'
import { and, eq } from 'drizzle-orm'
import { readdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises'
import { map } from 'lodash'
import NodeRSA from 'node-rsa'
import path from 'path'
import simpleGit, { type SimpleGit } from 'simple-git'

import { env } from '../../../config/env'
import { enqueueIngestJob } from '../../../lib/orchestrator-client'
import { emitTelemetry } from '../../../lib/telemetry'
import { IGNORED_DIRS, IGNORED_EXTENSIONS, IGNORED_FILES } from '../../../utils/ignores'
import { files, InsertFile, repos, SelectRepo } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { RepoStorageService } from '../../repo-storage/services/repo-storage.service'

interface CloneConfig {
  cloneUrl: string
  safeLogUrl: string
  secretsToMask: string[]
  sshPrivateKey: Nullable<string>
}

type RepoGitAuthType = 'https_token' | 'none' | 'ssh_key'

@Injectable()
export class RepoFetcherService {
  private logger: Logger = new Logger(RepoFetcherService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly repoStorageService: RepoStorageService,
  ) { }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForPending() {
    const [repoToClone] = await this.dbService.dbClient.select({
      id: repos.id
    })
      .from(repos)
      .where(eq(repos.cloneStatus, 'pending'))
      .limit(1)

    if (!repoToClone) {
      return
    }

    const [claimedRepo] = await this.dbService.dbClient.update(repos).set({
      cloneStatus: 'cloning'
    })
      .where(and(eq(repos.id, repoToClone.id), eq(repos.cloneStatus, 'pending')))
      .returning()

    if (!claimedRepo) {
      return
    }

    await this.cloneRepo(claimedRepo)
  }

  private buildCloneConfig(repo: SelectRepo): CloneConfig {
    const legacySecret = this.trimOrNull(repo.accessKey)
    const configuredSecret = this.trimOrNull(repo.gitAuthSecret)
    const effectiveSecret = configuredSecret ?? legacySecret
    const configuredAuthType = (repo.gitAuthType ?? 'none') as RepoGitAuthType
    const effectiveAuthType = configuredAuthType === 'none' && !configuredSecret && legacySecret
      ? 'ssh_key'
      : configuredAuthType

    if (effectiveAuthType === 'none') {
      return {
        cloneUrl: repo.gitUrl,
        safeLogUrl: this.sanitizeAuthUrl(repo.gitUrl),
        secretsToMask: [legacySecret].filter(Boolean) as string[],
        sshPrivateKey: null
      }
    }

    if (!effectiveSecret) {
      throw new Error('Git auth secret is required for private repository clone')
    }

    if (effectiveAuthType === 'https_token') {
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
    snapshot: { bucket: null | string, key: null | string, provider: 'local' | 'minio' }
  ): IngestJobRequestV1 {
    if (snapshot.provider !== 'minio' || !snapshot.bucket || !snapshot.key) {
      throw new Error(
        'Ingest contract requires MinIO snapshot location. Configure REPO_STORAGE_PROVIDER=minio and ensure snapshot upload succeeded.'
      )
    }

    return {
      contractVersion: 'ingest.v1',
      correlationId: `ingest-${repoId}-${crypto.randomUUID()}`,
      messageType: 'ingest.job.request' as IngestJobRequestV1['messageType'],
      payload: {
        parseOptions: {
          includeConfigFiles: env.ingestIncludeConfigFiles,
          includeDocumentationFiles: env.ingestIncludeDocumentationFiles,
          maxFileBytes: env.ingestMaxFileBytes,
          maxSegmentChars: env.ingestMaxSegmentChars
        },
        snapshot: {
          bucket: snapshot.bucket,
          key: snapshot.key,
          provider: 'minio',
          sourceCommitSha: commitSha
        }
      },
      producedAt: new Date().toISOString(),
      producer: 'web-api' as IngestJobRequestV1['producer'],
      repoId
    }
  }

  private async cloneRepo(repo: SelectRepo) {
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
      const snapshot = await this.repoStorageService.persistSnapshot({
        commitSha,
        repoId: repo.id,
        sourceDir: targetPath
      })

      await this.dbService.dbClient.update(repos)
        .set({
          cloneStatus: 'cloned',
          defaultBranch: checkedOutBranch,
          docsStatus: 'pending',
          documentation: null,
          embeddingStatus: 'pending',
          path: targetPath,
          sourceCommitSha: commitSha,
          storageBucket: snapshot.bucket,
          storageKey: snapshot.key,
          storageProvider: snapshot.provider
        })
        .where(eq(repos.id, repo.id))

      const filePaths = await this.getAllFiles(targetPath)
      const filesData = await Promise.all(
        map(filePaths, async (filePath): Promise<InsertFile> => {
          const relPath = path.relative(targetPath, filePath)
          const stats = await stat(filePath)
          const hash = await this.hashFile(filePath)

          return {
            hash,
            lastModified: stats.mtime.toISOString(),
            path: relPath,
            repoId: repo.id
          }
        }),

      )

      await this.dbService.dbClient.delete(files).where(eq(files.repoId, repo.id))
      await this.dbService.dbClient.insert(files).values(filesData)

      try {
        const ingestMessage = this.buildIngestJobRequest(repo.id, commitSha, snapshot)
        await enqueueIngestJob(ingestMessage)
        emitTelemetry({
          component: 'repo-fetcher.service',
          details: {
            bucket: ingestMessage.payload.snapshot.bucket,
            key: ingestMessage.payload.snapshot.key
          },
          event: 'ingest_job_request_published',
          level: 'info',
          queueName: 'ingest',
          repoId: repo.id,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'ok'
        })
        this.logger.log(`✓ Cloned, indexed, and queued ingest for ${repo.name}`)
      } catch (cause) {
        const safeCauseMessage = this.sanitizeErrorMessage(cause, cloneConfig.secretsToMask)

        await this.dbService.dbClient.update(repos)
          .set({
            docsStatus: 'failed',
            embeddingStatus: 'failed'
          })
          .where(eq(repos.id, repo.id))

        emitTelemetry({
          component: 'repo-fetcher.service',
          details: {
            errorMessage: safeCauseMessage,
            errorName: cause instanceof Error ? cause.name : 'UnknownError'
          },
          event: 'ingest_job_request_publish_failed',
          level: 'error',
          queueName: 'ingest',
          repoId: repo.id,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'error'
        })
        this.logger.error(`✗ Failed to enqueue ingest for ${repo.name}: ${safeCauseMessage}`)
      }
    } catch (error: unknown) {
      const safeErrorMessage = this.sanitizeErrorMessage(error, cloneConfig.secretsToMask)
      this.logger.error(`✗ Error cloning ${repo.name}: ${safeErrorMessage}`)

      await this.dbService.dbClient.update(repos)
        .set({ cloneStatus: 'failed' })
        .where(eq(repos.id, repo.id))
      throw new Error(safeErrorMessage)
    } finally {
      if (tmpKeyPath) {
        await unlink(tmpKeyPath).catch(() => { })
      }
      if (gitEnvBackup === undefined) {
        delete process.env.GIT_SSH_COMMAND
      } else {
        process.env.GIT_SSH_COMMAND = gitEnvBackup
      }
    }
  }

  private async fetchRemoteBranches(git: SimpleGit, cloneUrl: string): Promise<Set<string>> {
    try {
      const output = await git.listRemote([cloneUrl, 'refs/heads/*'])
      const branches = new Set<string>()

      for (const line of output.split('\n')) {
        const match = line.match(/refs\/heads\/(.+)$/)
        if (match?.[1]) {
          branches.add(match[1].trim())
        }
      }

      return branches
    } catch {
      this.logger.warn('Could not list remote branches, resolver will rely on candidate order')
      return new Set()
    }
  }

  private async fetchRemoteDefaultBranch(git: SimpleGit, cloneUrl: string): Promise<null | string> {
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
        if (
          !IGNORED_EXTENSIONS.has(ext)
          && !IGNORED_FILES.has(entry.name)
        ) {
          files.push(entryPath)
        }
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

  private async resolveBranchToClone(
    git: SimpleGit,
    cloneUrl: string,
    configuredBranch: null | string
  ): Promise<null | string> {
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
    if (gitUrl.startsWith('https://') || gitUrl.startsWith('http://')) {
      return gitUrl
    }

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

  private trimOrNull(value: null | string | undefined): null | string {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
}
