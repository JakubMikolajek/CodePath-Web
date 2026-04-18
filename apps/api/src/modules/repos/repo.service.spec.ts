import { BadRequestException } from '@nestjs/common'

import { RepoService } from './repo.service'

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
})
