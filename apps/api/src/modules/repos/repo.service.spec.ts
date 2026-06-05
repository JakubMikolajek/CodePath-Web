import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'

import { RepoService } from './services/repo.service'

function createDbMocks(returningRows: unknown[] = [{
  cloneStatus: 'pending',
  docsStatus: 'pending',
  embeddingStatus: 'pending',
  id: 1,
  name: 'repo'
}]) {
  const returningMock = jest.fn().mockResolvedValue(returningRows)
  const valuesMock = jest.fn(() => ({
    returning: returningMock
  }))
  const insertMock = jest.fn(() => ({
    values: valuesMock
  }))

  return {
    dbService: {
      dbClient: {
        insert: insertMock
      }
    },
    mocks: {
      insertMock,
      returningMock,
      valuesMock
    }
  }
}

function createPipelineDbMocks(repo: null | Record<string, unknown>, updatedRepo?: Record<string, unknown>) {
  const limitMock = jest.fn().mockResolvedValue(repo ? [repo] : [])
  const selectWhereMock = jest.fn(() => ({ limit: limitMock }))
  const fromMock = jest.fn(() => ({ where: selectWhereMock }))
  const selectMock = jest.fn(() => ({ from: fromMock }))

  const returningMock = jest.fn().mockResolvedValue(updatedRepo ? [updatedRepo] : [])
  const updateWhereMock = jest.fn(() => ({ returning: returningMock }))
  const setMock = jest.fn(() => ({ where: updateWhereMock }))
  const updateMock = jest.fn(() => ({ set: setMock }))

  return {
    dbService: {
      dbClient: {
        select: selectMock,
        update: updateMock
      }
    },
    mocks: {
      returningMock,
      setMock,
      updateWhereMock
    }
  }
}

describe('RepoService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('uses https token auth with oauth2 username by default', async () => {
    const { dbService, mocks } = createDbMocks()
    const service = new RepoService(dbService as never)

    await service.createRepo({
      authSecret: 'token-123',
      authType: 'https_token',
      gitUrl: 'https://gitlab.com/acme/demo.git',
      name: 'demo',
      userId: 7
    })

    expect(mocks.valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      accessKey: null,
      defaultBranch: null,
      gitAuthSecret: 'token-123',
      gitAuthType: 'https_token',
      gitAuthUsername: 'oauth2'
    }))
  })

  it('falls back to legacy ssh auth when only accessKey is provided', async () => {
    const { dbService, mocks } = createDbMocks()
    const service = new RepoService(dbService as never)

    await service.createRepo({
      accessKey: 'legacy-private-key',
      gitUrl: 'git@gitlab.com:acme/demo.git',
      name: 'demo',
      userId: 8
    })

    expect(mocks.valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      accessKey: 'legacy-private-key',
      gitAuthSecret: 'legacy-private-key',
      gitAuthType: 'ssh_key',
      gitAuthUsername: null
    }))
  })

  it('keeps auth disabled when authType is none', async () => {
    const { dbService, mocks } = createDbMocks()
    const service = new RepoService(dbService as never)

    await service.createRepo({
      authType: 'none',
      gitUrl: 'https://github.com/acme/public-repo.git',
      name: 'public-repo',
      userId: 9
    })

    expect(mocks.valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      accessKey: null,
      gitAuthSecret: null,
      gitAuthType: 'none',
      gitAuthUsername: null
    }))
  })

  it('throws when auth type requires secret but none is provided', async () => {
    const { dbService } = createDbMocks()
    const service = new RepoService(dbService as never)

    await expect(service.createRepo({
      authType: 'https_token',
      gitUrl: 'https://github.com/acme/private-repo.git',
      name: 'private-repo',
      userId: 10
    })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('resets clone pipeline to pending state', async () => {
    const repo = {
      cloneStatus: 'failed',
      docsStatus: 'failed',
      embeddingStatus: 'failed',
      id: 11,
      userId: 7
    }
    const updatedRepo = {
      cloneStatus: 'pending',
      docsStatus: 'pending',
      embeddingStatus: 'pending',
      id: 11,
      lastPipelineError: null,
      pipelineUpdatedAt: '2026-06-05T17:00:00.000Z'
    }
    const { dbService, mocks } = createPipelineDbMocks(repo, updatedRepo)
    const service = new RepoService(dbService as never)

    const result = await service.retryClonePipeline(7, 11)

    expect(mocks.setMock).toHaveBeenCalledWith(expect.objectContaining({
      cloneStatus: 'pending',
      docsStatus: 'pending',
      documentation: null,
      embeddingStatus: 'pending',
      sourceCommitSha: null,
      storageBucket: null,
      storageKey: null
    }))
    expect(result).toEqual(updatedRepo)
  })

  it('requeues ingest from the existing repository snapshot', async () => {
    const repo = {
      cloneStatus: 'cloned',
      docsStatus: 'failed',
      embeddingStatus: 'failed',
      id: 12,
      sourceCommitSha: 'abc123',
      storageBucket: 'snapshots',
      storageKey: 'repos/12.tar.zst',
      storageProvider: 'minio',
      userId: 7
    }
    const { dbService, mocks } = createPipelineDbMocks(repo)
    const repoFetcherService = {
      requeueIngestJob: jest.fn().mockResolvedValue(undefined)
    }
    const service = new RepoService(dbService as never, repoFetcherService as never)

    const result = await service.retryIngestPipeline(7, 12)

    expect(mocks.setMock).toHaveBeenCalledWith(expect.objectContaining({
      docsStatus: 'pending',
      documentation: null,
      embeddingStatus: 'processing'
    }))
    expect(repoFetcherService.requeueIngestJob).toHaveBeenCalledWith(repo)
    expect(result).toEqual({
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'processing',
      id: 12,
      lastPipelineError: null,
      pipelineUpdatedAt: expect.any(String)
    })
  })

  it('marks ingest as failed when requeueing fails', async () => {
    const repo = {
      cloneStatus: 'cloned',
      docsStatus: 'failed',
      embeddingStatus: 'failed',
      id: 13,
      sourceCommitSha: 'def456',
      storageBucket: 'snapshots',
      storageKey: 'repos/13.tar.zst',
      storageProvider: 'minio',
      userId: 7
    }
    const { dbService, mocks } = createPipelineDbMocks(repo)
    const repoFetcherService = {
      requeueIngestJob: jest.fn().mockRejectedValue(new Error('queue offline'))
    }
    const service = new RepoService(dbService as never, repoFetcherService as never)

    await expect(service.retryIngestPipeline(7, 13)).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(mocks.setMock).toHaveBeenLastCalledWith(expect.objectContaining({
      docsStatus: 'failed',
      embeddingStatus: 'failed'
    }))
  })
})
