import crypto from 'crypto'
import { existsSync, rmSync } from 'fs'
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import path from 'path'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { has, map, replace } from 'lodash'
import NodeRSA from 'node-rsa'
import simpleGit from 'simple-git'
import { Repository } from 'typeorm'

import { GenericNullable } from '../../interfaces/globals'
import { IGNORED_DIRS, IGNORED_EXTENSIONS, IGNORED_FILES } from '../../utils/ignores'

import { File } from './entities/file.entity'
import { Repo } from './entities/repo.entity'

const projectRoot = path.resolve(__dirname, '../../../../../')
const defaultReposPath = path.join(projectRoot, 'storage', 'repos')

@Injectable()
export class RepoFetcherService {
  constructor(
    @InjectRepository(Repo)
    private readonly repoRepo: Repository<Repo>,
    @InjectRepository(File)
    private readonly fileRepo: Repository<File>,
  ) {}

  private logger: Logger = new Logger(RepoFetcherService.name)
  private readonly REPOS_PATH = defaultReposPath

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForPending() {
    const repo = await this.repoRepo.findOne({
      where: { cloneStatus: 'pending' },
    })

    if (!repo) return

    await this.cloneRepo(repo)
  }

  private async cloneRepo(repo: Repo) {
    const git = simpleGit()
    const sanitizedName = replace(repo.name, /[^a-zA-Z0-9_-]/g, '_')
    const targetPath = path.join(this.REPOS_PATH, sanitizedName)

    this.logger.log(`Cloning: ${repo.gitUrl} -> ${targetPath}`)

    try {
      repo.cloneStatus = 'cloning'
      await this.repoRepo.save(repo)

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

      repo.cloneStatus = 'cloned'
      repo.path = targetPath

      await this.repoRepo.save(repo)

      const filePaths = await this.getAllFiles(targetPath)
      const filesData = await Promise.all(
        map(filePaths, async (filePath) => {
          const relPath = path.relative(targetPath, filePath)
          const stats = await stat(filePath)
          const hash = await this.hashFile(filePath)

          return this.fileRepo.create({
            repo,
            path: relPath,
            hash,
            lastModified: stats.mtime,
          })
        }),
      )

      await this.fileRepo.save(filesData)

      this.logger.log(`✓ Cloned and indexed ${repo.name}`)

      if (tmpKeyPath) {
        await unlink(tmpKeyPath).catch(() => {})
        process.env.GIT_SSH_COMMAND = gitEnvBackup
      }
    }
    catch (error: any) {
      this.logger.error(`✗ Error cloning ${repo.name}: ${error.message}`)

      repo.cloneStatus = 'failed'
      await this.repoRepo.save(repo)
      throw error
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const entryPath = path.resolve(dir, entry.name)

      if (entry.isDirectory()) {
        if (!has(IGNORED_DIRS, entry.name)) {
          const subFiles = await this.getAllFiles(entryPath)
          files.push(...subFiles)
        }
      }
      else {
        const ext = path.extname(entry.name).toLowerCase()
        if (
          !has(IGNORED_EXTENSIONS, ext)
          && !has(IGNORED_FILES, entry.name)
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
