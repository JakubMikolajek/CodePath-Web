import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'

import { env } from '../../../config/env'
import { SelectRepo } from '../../db/schema'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(__dirname, '../../../../../../')

interface PersistSnapshotInput {
  commitSha: string
  repoId: number
  sourceDir: string
}

interface SnapshotLocation {
  bucket: null | string
  key: null | string
  provider: 'local' | 'minio'
}

interface PreparedWorkspace {
  cleanup: () => Promise<void>
  workspacePath: string
}

@Injectable()
export class RepoStorageService {
  private readonly localReposPath = path.resolve(projectRoot, env.repoStorageLocalPath)
  private readonly logger = new Logger(RepoStorageService.name)
  private readonly minioBucket = env.repoStorageMinioBucket
  private readonly provider = env.repoStorageProvider
  private readonly s3Client: null | S3Client = this.buildS3Client()

  async ensureLocalWorkspaceRoot(): Promise<void> {
    await mkdir(this.localReposPath, { recursive: true })
  }

  async checkHealth(): Promise<{ message: string, provider: 'local' | 'minio' }> {
    if (this.provider !== 'minio') {
      await this.ensureLocalWorkspaceRoot()
      return {
        message: `Local repository storage available at ${this.localReposPath}`,
        provider: 'local'
      }
    }

    if (!this.s3Client) {
      throw new Error('MinIO provider is enabled but S3 client is not initialized')
    }

    await this.s3Client.send(new HeadBucketCommand({ Bucket: this.minioBucket }))

    return {
      message: `MinIO bucket "${this.minioBucket}" is available`,
      provider: 'minio'
    }
  }

  getCloneWorkspacePath(repoId: number, repoName: string): string {
    const sanitized = repoName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.localReposPath, `${repoId}-${sanitized}`)
  }

  async persistSnapshot(input: PersistSnapshotInput): Promise<SnapshotLocation> {
    if (this.provider !== 'minio') {
      return {
        bucket: null,
        key: null,
        provider: 'local'
      }
    }

    if (!this.s3Client) {
      throw new Error('MinIO provider is enabled but S3 client is not initialized')
    }

    await this.ensureMinioBucket()

    const key = this.buildSnapshotKey(input.repoId, input.commitSha)
    const archivePath = await this.createArchive(input.sourceDir)

    try {
      const archiveBytes = await readFile(archivePath)
      this.logger.log(
        `Uploading snapshot to MinIO: repo=${input.repoId} key=${key} size=${archiveBytes.byteLength}B`
      )
      await this.s3Client.send(new PutObjectCommand({
        Body: archiveBytes,
        Bucket: this.minioBucket,
        ContentLength: archiveBytes.byteLength,
        ContentType: 'application/gzip',
        Key: key
      }))
    } finally {
      await rm(path.dirname(archivePath), { force: true, recursive: true })
    }

    return {
      bucket: this.minioBucket,
      key,
      provider: 'minio'
    }
  }

  async prepareWorkspace(repo: SelectRepo): Promise<PreparedWorkspace> {
    const storageProvider = this.resolveStorageProvider(repo)
    if (
      storageProvider === 'minio'
      && repo.storageBucket
      && repo.storageKey
    ) {
      if (!this.s3Client) {
        throw new Error('MinIO snapshot requested but S3 client is not configured')
      }

      const workspacePath = await mkdtemp(path.join(tmpdir(), `codepath-repo-${repo.id}-`))
      const archivePath = path.join(workspacePath, 'snapshot.tar.gz')

      try {
        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: repo.storageBucket,
          Key: repo.storageKey
        }))

        if (!response.Body) {
          throw new Error(`Snapshot body is empty for repo ${repo.id}`)
        }

        await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(archivePath))
        await this.extractArchive(archivePath, workspacePath)
        await rm(archivePath, { force: true })

        return {
          cleanup: async () => rm(workspacePath, { force: true, recursive: true }),
          workspacePath
        }
      } catch (error) {
        await rm(workspacePath, { force: true, recursive: true })
        throw error
      }
    }

    if (!repo.path) {
      throw new Error(`Repository ${repo.id} does not have local path or snapshot location`)
    }

    return {
      cleanup: async () => Promise.resolve(),
      workspacePath: repo.path
    }
  }

  private buildS3Client(): null | S3Client {
    if (this.provider !== 'minio') {
      return null
    }

    const protocol = env.repoStorageMinioUseSsl ? 'https' : 'http'
    const endpoint = `${protocol}://${env.repoStorageMinioEndpoint}:${env.repoStorageMinioPort}`

    return new S3Client({
      credentials: {
        accessKeyId: env.repoStorageMinioAccessKey,
        secretAccessKey: env.repoStorageMinioSecretKey
      },
      endpoint,
      forcePathStyle: env.repoStorageMinioForcePathStyle,
      region: env.repoStorageMinioRegion
    })
  }

  private buildSnapshotKey(repoId: number, commitSha: string): string {
    const normalizedCommitSha = commitSha.trim().slice(0, 40) || 'unknown'
    return `repos/${repoId}/${normalizedCommitSha}.tar.gz`
  }

  private async createArchive(sourceDir: string): Promise<string> {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'codepath-snapshot-'))
    const archivePath = path.join(tempDir, 'snapshot.tar.gz')

    await execFileAsync('tar', ['-czf', archivePath, '-C', sourceDir, '.'])
    return archivePath
  }

  private async ensureMinioBucket(): Promise<void> {
    if (!this.s3Client) {
      return
    }

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.minioBucket }))
      return
    } catch (error) {
      this.logger.warn(`Bucket "${this.minioBucket}" missing, creating it`)
    }

    await this.s3Client.send(new CreateBucketCommand({ Bucket: this.minioBucket }))
  }

  private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', targetDir])
  }

  private resolveStorageProvider(repo: SelectRepo): 'local' | 'minio' {
    const provider = repo.storageProvider?.trim().toLowerCase()
    if (provider === 'minio') {
      return 'minio'
    }
    return 'local'
  }
}
