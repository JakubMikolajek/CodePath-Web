import crypto from 'crypto'
import { existsSync, rmSync } from 'fs'
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import path from 'path'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { GenericNullable } from '@workspace/codepath-common/globals'
import { eq } from 'drizzle-orm'
import { has, map, replace } from 'lodash'
import NodeRSA from 'node-rsa'
import simpleGit from 'simple-git'

import { IGNORED_DIRS, IGNORED_EXTENSIONS, IGNORED_FILES } from '../../utils/ignores'
import { DbService } from '../db/db.service'
import { files, InsertFile, repos, SelectRepo } from '../db/schema'

const projectRoot = path.resolve(__dirname, '../../../../../../')
const defaultReposPath = path.join(projectRoot, 'storage', 'repos')

@Injectable()
export class RepoFetcherService {
  constructor(
    private readonly dbService: DbService,
  ) { }

  private logger: Logger = new Logger(RepoFetcherService.name)
  private readonly REPOS_PATH = defaultReposPath

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForPending() {
    const [repoToClone] = await this.dbService.dbClient.select()
      .from(repos)
      .where(eq(repos.cloneStatus, 'pending'))
      .limit(1)

    if (!repoToClone) {
      return
    }

    await this.cloneRepo(repoToClone)
  }

  private async cloneRepo(repo: SelectRepo) {
    const git = simpleGit()
    const sanitizedName = replace(repo.name, /[^a-zA-Z0-9_-]/g, '_')
    const targetPath = path.join(this.REPOS_PATH, sanitizedName)

    this.logger.log(`Cloning: ${repo.gitUrl} -> ${targetPath}`)

    try {
      await this.dbService.dbClient.update(repos)
        .set({ cloneStatus: 'cloning' })
        .where(eq(repos.id, repo.id))

      if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true })
      }
      else {
        try {
          await access(this.REPOS_PATH)
        }
        catch {
          await mkdir(this.REPOS_PATH, { recursive: true })
        }
      }

      let tmpKeyPath: GenericNullable<string> = null
      const gitEnvBackup = process.env.GIT_SSH_COMMAND

      if (repo.accessKey) {
        const key = new NodeRSA(repo.accessKey).exportKey('openssh-private')
        tmpKeyPath = `/tmp/repo_${repo.id}_id_rsa`
        await writeFile(tmpKeyPath, key, { mode: 0o600 })
        process.env.GIT_SSH_COMMAND = `ssh -i ${tmpKeyPath} -o StrictHostKeyChecking=no`
      }

      // await git.clone(repo.gitUrl, targetPath, ['--branch', 'develop', '--single-branch'])
      await git.clone(repo.gitUrl, targetPath)

      await this.dbService.dbClient.update(repos)
        .set({
          cloneStatus: 'cloned',
          path: targetPath,
        })
        .where(eq(repos.id, repo.id))

      const filePaths = await this.getAllFiles(targetPath)
      const filesData = await Promise.all(
        map(filePaths, async (filePath): Promise<InsertFile> => {
          const relPath = path.relative(targetPath, filePath)
          const stats = await stat(filePath)
          const hash = await this.hashFile(filePath)

          return {
            repoId: repo.id,
            path: relPath,
            hash,
            lastModified: stats.mtime.toISOString(),
          }
        }),

      )

      await this.dbService.dbClient.insert(files).values(filesData)

      this.logger.log(`✓ Cloned and indexed ${repo.name}`)

      if (tmpKeyPath) {
        await unlink(tmpKeyPath).catch(() => { })
        process.env.GIT_SSH_COMMAND = gitEnvBackup
      }
    }
    catch (error: any) {
      this.logger.error(`✗ Error cloning ${repo.name}: ${error.message}`)

      repo.cloneStatus = 'failed'

      await this.dbService.dbClient.update(repos)
        .set({ cloneStatus: 'failed' })
        .where(eq(repos.id, repo.id))
      throw error
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
      }
      else {
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
