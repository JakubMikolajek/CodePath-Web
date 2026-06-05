import { RepoFetcherService } from './services/repo-fetcher.service'

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

type RepoFetcherPrivateApi = {
  buildCloneConfig: (repo: CloneRepoShape) => CloneConfigShape
  fetchRemoteBranches: (git: unknown, cloneUrl: string) => Promise<Set<string>>
  fetchRemoteDefaultBranch: (git: unknown, cloneUrl: string) => Promise<null | string>
  resolveBranchToClone: (git: unknown, cloneUrl: string, configuredBranch: null | string) => Promise<null | string>
  sanitizeErrorMessage: (error: unknown, secretsToMask: string[]) => string
}

function createService() {
  return new RepoFetcherService(
    { dbClient: {} } as never,
    {} as never
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

describe('RepoFetcherService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
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

  it('marks stale active pipeline stages as failed', async () => {
    const dbMocks = createStaleDbMocks([[{ id: 1 }], [{ id: 2 }], [{ id: 3 }]])
    const service = new RepoFetcherService(
      { dbClient: dbMocks.dbClient } as never,
      {} as never
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
