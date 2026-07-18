import type { IngestJobRequestV2 } from '@workspace/codepath-common/ingest'
import { rm, stat } from 'fs/promises'
import simpleGit from 'simple-git'

import { RepoFetcherService } from './services/repo-fetcher.service'

jest.mock('fs/promises', () => ({
  ...jest.requireActual<typeof import('fs/promises')>('fs/promises'),
  rm: jest.fn(),
  stat: jest.fn()
}))
jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn()
}))

type CloneConfigShape = {
  cloneUrl: string
  safeLogUrl: string
  secretsToMask: string[]
  sshPrivateKey: null | string
}

type CloneRepoShape = {
  accessKey: null | string
  gitAuthSecret: null | string
  gitAuthType: 'https_token' | 'none' | 'ssh_key'
  gitAuthUsername?: null | string
  gitUrl: string
}

type ClonePipelineRepoShape = CloneRepoShape & {
  defaultBranch: null | string
  id: number
  name: string
}

type FileHash = {
  hash: string
  path: string
}

type RepoFetcherPrivateApi = {
  buildCloneConfig: (repo: CloneRepoShape) => CloneConfigShape
  cloneRepo: (repo: ClonePipelineRepoShape) => Promise<void>
  fetchRemoteBranches: (git: unknown, cloneUrl: string) => Promise<Set<string>>
  fetchRemoteDefaultBranch: (git: unknown, cloneUrl: string) => Promise<null | string>
  getAllFiles: (dir: string) => Promise<string[]>
  hashFile: (filePath: string) => Promise<string>
  resolveBranchToClone: (git: unknown, cloneUrl: string, configuredBranch: null | string) => Promise<null | string>
  sanitizeErrorMessage: (error: unknown, secretsToMask: string[]) => string
}

function createService() {
  return new RepoFetcherService(
    { dbClient: {} } as never,
    {} as never,
    { enqueueIngestJob: jest.fn() } as never
  )
}

function createStaleDbMocks(returningRows: unknown[][]) {
  const returningMock = jest.fn()
  for (const rows of returningRows) returningMock.mockResolvedValueOnce(rows)

  const whereMock = jest.fn(() => ({
    returning: returningMock
  }))
  const setMock = jest.fn(() => ({
    where: whereMock
  }))
  const updateMock = jest.fn(() => ({
    set: setMock
  }))

  return {
    dbClient: {
      update: updateMock
    },
    mocks: {
      returningMock,
      setMock,
      updateMock,
      whereMock
    }
  }
}

async function runCloneScenario(previousFiles: FileHash[], currentFiles: FileHash[]) {
  const targetPath = '/tmp/codepath-repos/10-demo'
  const enqueueIngestJob = jest.fn<Promise<void>, [IngestJobRequestV2]>().mockResolvedValue(undefined)
  const selectWhereMock = jest.fn().mockResolvedValue(previousFiles)
  const selectFromMock = jest.fn(() => ({
    where: selectWhereMock
  }))
  const selectMock = jest.fn(() => ({
    from: selectFromMock
  }))
  const writeWhereMock = jest.fn().mockResolvedValue([])
  const updateMock = jest.fn(() => ({
    set: jest.fn(() => ({
      where: writeWhereMock
    }))
  }))
  const deleteMock = jest.fn(() => ({
    where: writeWhereMock
  }))
  const insertMock = jest.fn(() => ({
    values: jest.fn().mockResolvedValue([])
  }))
  const service = new RepoFetcherService(
    {
      dbClient: {
        delete: deleteMock,
        insert: insertMock,
        select: selectMock,
        update: updateMock
      }
    } as never,
    {
      ensureLocalWorkspaceRoot: jest.fn().mockResolvedValue(undefined),
      getCloneWorkspacePath: jest.fn().mockReturnValue(targetPath),
      persistSnapshot: jest.fn().mockResolvedValue({
        bucket: 'codepath-repos',
        key: 'repos/10/commit-sha.tar.gz',
        provider: 'minio'
      })
    } as never,
    { enqueueIngestJob } as never
  )
  const privateApi = service as unknown as RepoFetcherPrivateApi
  const git = {
    clone: jest.fn().mockResolvedValue(undefined),
    revparse: jest.fn()
      .mockResolvedValueOnce('main\n')
      .mockResolvedValueOnce('commit-sha\n')
  }

  jest.mocked(simpleGit).mockReturnValue(git as never)
  jest.mocked(rm).mockResolvedValue(undefined)
  jest.mocked(stat).mockResolvedValue({ mtime: new Date('2026-07-10T12:00:00.000Z') } as never)
  jest.spyOn(privateApi, 'resolveBranchToClone').mockResolvedValue('main')
  jest.spyOn(privateApi, 'getAllFiles').mockResolvedValue(
    currentFiles.map(file => `${targetPath}/${file.path}`)
  )
  jest.spyOn(privateApi, 'hashFile').mockImplementation(filePath => {
    const file = currentFiles.find(candidate => `${targetPath}/${candidate.path}` === filePath)
    if (!file) throw new Error(`Missing hash fixture for ${filePath}`)
    return Promise.resolve(file.hash)
  })

  await privateApi.cloneRepo({
    accessKey: null,
    defaultBranch: 'main',
    gitAuthSecret: null,
    gitAuthType: 'none',
    gitAuthUsername: null,
    gitUrl: 'https://gitlab.com/acme/demo.git',
    id: 10,
    name: 'demo'
  })

  const message = enqueueIngestJob.mock.calls[0]?.[0]
  if (!message) throw new Error('Expected cloneRepo to enqueue an ingest job')

  return {
    deleteMock,
    message,
    selectMock
  }
}

describe('RepoFetcherService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('builds https clone config from token auth and masks token in logs', () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    const config = privateApi.buildCloneConfig({
      accessKey: null,
      gitAuthSecret: 'token-123',
      gitAuthType: 'https_token',
      gitAuthUsername: 'oauth2',
      gitUrl: 'git@gitlab.com:acme/demo.git'
    })

    expect(config.cloneUrl).toBe('https://oauth2:token-123@gitlab.com/acme/demo.git')
    expect(config.safeLogUrl).toBe('https://***:***@gitlab.com/acme/demo.git')
    expect(config.secretsToMask).toEqual(['token-123'])
    expect(config.sshPrivateKey).toBeNull()
  })

  it('falls back to ssh legacy flow when only accessKey exists', () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    const config = privateApi.buildCloneConfig({
      accessKey: 'legacy-private-key',
      gitAuthSecret: null,
      gitAuthType: 'none',
      gitUrl: 'git@gitlab.com:acme/demo.git'
    })

    expect(config.cloneUrl).toBe('git@gitlab.com:acme/demo.git')
    expect(config.secretsToMask).toEqual(['legacy-private-key'])
    expect(config.sshPrivateKey).toBe('legacy-private-key')
  })

  it('prefers configured branch when it exists remotely', async () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    jest.spyOn(privateApi, 'fetchRemoteDefaultBranch').mockResolvedValue('main')
    jest.spyOn(privateApi, 'fetchRemoteBranches').mockResolvedValue(new Set(['develop', 'main']))

    const selected = await privateApi.resolveBranchToClone({}, 'https://gitlab.com/acme/demo.git', 'develop')
    expect(selected).toBe('develop')
  })

  it('falls back to remote default when configured branch is missing', async () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    jest.spyOn(privateApi, 'fetchRemoteDefaultBranch').mockResolvedValue('main')
    jest.spyOn(privateApi, 'fetchRemoteBranches').mockResolvedValue(new Set(['main', 'master']))

    const selected = await privateApi.resolveBranchToClone({}, 'https://gitlab.com/acme/demo.git', 'feature/x')
    expect(selected).toBe('main')
  })

  it('falls back through develop/main/master candidates when remote default is unavailable', async () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    jest.spyOn(privateApi, 'fetchRemoteDefaultBranch').mockResolvedValue(null)
    jest.spyOn(privateApi, 'fetchRemoteBranches').mockResolvedValue(new Set(['master']))

    const selected = await privateApi.resolveBranchToClone({}, 'https://gitlab.com/acme/demo.git', null)
    expect(selected).toBe('master')
  })

  it('masks secrets and embedded auth credentials in error messages', () => {
    const service = createService()
    const privateApi = service as unknown as RepoFetcherPrivateApi
    const message = privateApi.sanitizeErrorMessage(
      new Error('fatal token-123 at https://oauth2:token-123@gitlab.com/acme/demo.git'),
      ['token-123']
    )

    expect(message).not.toContain('token-123')
    expect(message).not.toContain('oauth2:token-123@')
    expect(message).toContain('https://***@gitlab.com/acme/demo.git')
  })

  describe('cloneRepo delta ingest', () => {
    it('omits delta fields on the first clone when no files were previously tracked', async () => {
      const { deleteMock, message, selectMock } = await runCloneScenario([], [
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'hash-b', path: 'src/b.ts' }
      ])

      expect(selectMock).toHaveBeenCalledTimes(1)
      expect(selectMock.mock.invocationCallOrder[0]).toBeLessThan(deleteMock.mock.invocationCallOrder[1])
      expect(message.payload).not.toHaveProperty('changedFilePaths')
      expect(message.payload).not.toHaveProperty('deletedFilePaths')
    })

    it('includes only the file whose content changed on a re-clone', async () => {
      const { message } = await runCloneScenario([
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'old-hash-b', path: 'src/b.ts' }
      ], [
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'new-hash-b', path: 'src/b.ts' }
      ])

      expect(message.payload.changedFilePaths).toEqual(['src/b.ts'])
      expect(message.payload).not.toHaveProperty('deletedFilePaths')
    })

    it('includes a previously tracked path that is absent on a re-clone', async () => {
      const { message } = await runCloneScenario([
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'hash-b', path: 'src/removed.ts' }
      ], [
        { hash: 'hash-a', path: 'src/a.ts' }
      ])

      expect(message.payload).not.toHaveProperty('changedFilePaths')
      expect(message.payload.deletedFilePaths).toEqual(['src/removed.ts'])
    })

    it('omits both delta fields when no files changed on a re-clone', async () => {
      const { message } = await runCloneScenario([
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'hash-b', path: 'src/b.ts' }
      ], [
        { hash: 'hash-a', path: 'src/a.ts' },
        { hash: 'hash-b', path: 'src/b.ts' }
      ])

      expect(message.payload).not.toHaveProperty('changedFilePaths')
      expect(message.payload).not.toHaveProperty('deletedFilePaths')
    })
  })

  it('marks stale active pipeline stages as failed', async () => {
    const dbMocks = createStaleDbMocks([[{ id: 1 }], [{ id: 2 }], [{ id: 3 }]])
    const service = new RepoFetcherService(
      { dbClient: dbMocks.dbClient } as never,
      {} as never,
      { enqueueIngestJob: jest.fn() } as never
    )

    await service.markStalePipelineStages()

    expect(dbMocks.mocks.updateMock).toHaveBeenCalledTimes(3)
    expect(dbMocks.mocks.setMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      cloneStatus: 'failed',
      docsStatus: 'failed',
      embeddingStatus: 'failed',
      lastPipelineError: expect.stringContaining('Clone stage exceeded')
    }))
    expect(dbMocks.mocks.setMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      docsStatus: 'failed',
      embeddingStatus: 'failed',
      lastPipelineError: expect.stringContaining('Embedding stage exceeded')
    }))
    expect(dbMocks.mocks.setMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      docsStatus: 'failed',
      lastPipelineError: expect.stringContaining('Documentation stage exceeded')
    }))
  })
})
