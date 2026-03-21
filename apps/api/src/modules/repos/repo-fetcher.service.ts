import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { GenericNullable } from '@workspace/codepath-common/globals'
import crypto from 'crypto'
import { and, eq } from 'drizzle-orm'
import { readdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises'
import { map } from 'lodash'
import NodeRSA from 'node-rsa'
import path from 'path'
import simpleGit from 'simple-git'

import { IGNORED_DIRS, IGNORED_EXTENSIONS, IGNORED_FILES } from '../../utils/ignores'
import { DbService } from '../db/db.service'
import { files, InsertFile, repos, SelectRepo } from '../db/schema'
import { RepoStorageService } from '../repo-storage/repo-storage.service'

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

  private async cloneRepo(repo: SelectRepo) {
    const git = simpleGit()
    const targetPath = this.repoStorageService.getCloneWorkspacePath(repo.id, repo.name)

    this.logger.log(`Cloning: ${repo.gitUrl} -> ${targetPath}`)

    let tmpKeyPath: GenericNullable<string> = null
    const gitEnvBackup = process.env.GIT_SSH_COMMAND
    try {
      await this.repoStorageService.ensureLocalWorkspaceRoot()
      await rm(targetPath, { force: true, recursive: true })

      if (repo.accessKey) {
        const key = new NodeRSA(repo.accessKey).exportKey('openssh-private')
        tmpKeyPath = `/tmp/repo_${repo.id}_id_rsa`
        await writeFile(tmpKeyPath, key, { mode: 0o600 })
        process.env.GIT_SSH_COMMAND = `ssh -i ${tmpKeyPath} -o StrictHostKeyChecking=no`
      }

      // await git.clone(repo.gitUrl, targetPath, ['--branch', 'develop', '--single-branch'])
      await git.clone(repo.gitUrl, targetPath)
      const repoGit = simpleGit(targetPath)
      const commitSha = (await repoGit.revparse(['HEAD'])).trim()
      const snapshot = await this.repoStorageService.persistSnapshot({
        commitSha,
        repoId: repo.id,
        sourceDir: targetPath
      })

      await this.dbService.dbClient.update(repos)
        .set({
          cloneStatus: 'cloned',
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

      this.logger.log(`✓ Cloned and indexed ${repo.name}`)
    } catch (error: any) {
      this.logger.error(`✗ Error cloning ${repo.name}: ${error.message}`)

      await this.dbService.dbClient.update(repos)
        .set({ cloneStatus: 'failed' })
        .where(eq(repos.id, repo.id))
      throw error
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
}
