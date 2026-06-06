import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { Nullable, StorageProvider } from '@workspace/codepath-common'

import { env } from '../../../config/env'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(__dirname, '../../../../../../')

interface PersistSnapshotInput {
  commitSha: string
  repoId: number
  sourceDir: string
}

interface SnapshotLocation {
  bucket: Nullable<string>
  key: Nullable<string>
  provider: StorageProvider
}

@Injectable()
export class RepoStorageService {
  private readonly localReposPath = path.resolve(projectRoot, env.repoStorageLocalPath)
  private readonly logger = new Logger(RepoStorageService.name)
  private readonly minioBucket = env.repoStorageMinioBucket
  private readonly provider = env.repoStorageProvider as StorageProvider
  private readonly s3Client: Nullable<S3Client> = this.buildS3Client()

  async checkHealth(): Promise<{ message: string, provider: StorageProvider }> {
    if (this.provider !== StorageProvider.MINIO) {
      await this.ensureLocalWorkspaceRoot()
      return { message: `Local repository storage available at ${this.localReposPath}`, provider: StorageProvider.LOCAL }
    }

    if (!this.s3Client) throw new Error('MinIO provider is enabled but S3 client is not initialized')

    await this.s3Client.send(new HeadBucketCommand({ Bucket: this.minioBucket }))

    return { message: `MinIO bucket "${this.minioBucket}" is available`, provider: StorageProvider.MINIO }
  }

  async ensureLocalWorkspaceRoot(): Promise<void> {
    await mkdir(this.localReposPath, { recursive: true })
  }

  getCloneWorkspacePath(repoId: number, repoName: string): string {
    const sanitized = repoName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.localReposPath, `${repoId}-${sanitized}`)
  }

  async persistSnapshot(input: PersistSnapshotInput): Promise<SnapshotLocation> {
    if (this.provider !== StorageProvider.MINIO) return { bucket: null, key: null, provider: StorageProvider.LOCAL }

    if (!this.s3Client) throw new Error('MinIO provider is enabled but S3 client is not initialized')

    await this.ensureMinioBucket()

    const key = this.buildSnapshotKey(input.repoId, input.commitSha)
    const archivePath = await this.createArchive(input.sourceDir)

    try {
      const archiveBytes = await readFile(archivePath)
      this.logger.log(`Uploading snapshot to MinIO: repo=${input.repoId} key=${key} size=${archiveBytes.byteLength}B`)

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

    return { bucket: this.minioBucket, key, provider: StorageProvider.MINIO }
  }

  private buildS3Client(): Nullable<S3Client> {
    if (this.provider !== StorageProvider.MINIO) {
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
    if (!this.s3Client) return

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.minioBucket }))
      return
    } catch (error) {
      this.logger.warn(`Bucket "${this.minioBucket}" missing, creating it`)
    }

    await this.s3Client.send(new CreateBucketCommand({ Bucket: this.minioBucket }))
  }
}
