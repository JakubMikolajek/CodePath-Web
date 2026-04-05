import { ConflictException, NotFoundException } from '@nestjs/common'

import { enqueueDocsJob } from '../../lib/orchestrator-client'
import { DocsService } from './docs.service'

jest.mock('../../lib/orchestrator-client', () => ({
  enqueueDocsJob: jest.fn()
}))

jest.mock('../../lib/telemetry', () => ({
  emitTelemetry: jest.fn()
}))

type RepoState = {
  cloneStatus: 'cloned' | 'cloning' | 'failed' | 'pending'
  docsStatus: 'failed' | 'pending' | 'processing' | 'ready'
  embeddingStatus: 'embedded' | 'failed' | 'pending' | 'processing'
  id: number
}

function createDbMocks(selectResults: unknown[], updateReturningRows: unknown[] = [{ id: 1 }]) {
  const limitMock = jest.fn()
  for (const result of selectResults) {
    limitMock.mockResolvedValueOnce(result)
  }

  const selectWhereMock = jest.fn(() => ({
    limit: limitMock
  }))
  const selectFromMock = jest.fn(() => ({
    where: selectWhereMock
  }))
  const selectMock = jest.fn(() => ({
    from: selectFromMock
  }))

  const returningMock = jest.fn().mockResolvedValue(updateReturningRows)
  const updateWhereMock = jest.fn(() => ({
    returning: returningMock
  }))
  const updateSetMock = jest.fn(() => ({
    where: updateWhereMock
  }))
  const updateMock = jest.fn(() => ({
    set: updateSetMock
  }))

  return {
    dbService: {
      dbClient: {
        select: selectMock,
        update: updateMock
      }
    },
    mocks: {
      limitMock,
      returningMock,
      selectMock,
      updateMock,
      updateSetMock,
      updateWhereMock
    }
  }
}

describe('DocsService', () => {
  const enqueueDocsJobMock = jest.mocked(enqueueDocsJob)

  beforeEach(() => {
    jest.restoreAllMocks()
    enqueueDocsJobMock.mockReset()
  })

  it('throws when repository clone is not ready', async () => {
    const repoState: RepoState = {
      cloneStatus: 'pending',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 10
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never)

    await expect(service.generateDocumentation(1, 10)).rejects.toBeInstanceOf(ConflictException)
    expect(enqueueDocsJobMock).not.toHaveBeenCalled()
  })

  it('returns already processing response when docs job is in progress', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'processing',
      embeddingStatus: 'embedded',
      id: 20
    }
    const { dbService, mocks } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never)

    await expect(service.generateDocumentation(2, 20)).resolves.toEqual({
      message: 'Documentation generation already in progress',
      status: 'processing'
    })
    expect(mocks.updateMock).not.toHaveBeenCalled()
    expect(enqueueDocsJobMock).not.toHaveBeenCalled()
  })

  it('throws actionable message when embeddings are still processing', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'processing',
      id: 25
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never)

    await expect(service.generateDocumentation(2, 25)).rejects.toThrow(
      'Embeddings are still processing. Wait for completion before generating documentation.'
    )
    expect(enqueueDocsJobMock).not.toHaveBeenCalled()
  })

  it('throws actionable message when embeddings failed', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'failed',
      id: 26
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never)

    await expect(service.generateDocumentation(2, 26)).rejects.toThrow(
      'Embeddings failed. Re-run embedding before generating documentation.'
    )
    expect(enqueueDocsJobMock).not.toHaveBeenCalled()
  })

  it('claims docs processing and publishes docs job', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 30
    }
    const { dbService } = createDbMocks([[repoState]], [{ id: 30 }])
    const service = new DocsService(dbService as never)

    enqueueDocsJobMock.mockResolvedValue(undefined)

    await expect(service.generateDocumentation(3, 30)).resolves.toEqual({
      message: 'Documentation generation started',
      status: 'processing'
    })
    expect(enqueueDocsJobMock).toHaveBeenCalledWith({ repoId: 30 })
  })

  it('marks docs as failed when publish throws', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 40
    }
    const { dbService, mocks } = createDbMocks([[repoState]], [{ id: 40 }])
    const service = new DocsService(dbService as never)

    enqueueDocsJobMock.mockRejectedValue(new Error('publish failed'))

    await expect(service.generateDocumentation(4, 40)).rejects.toThrow('publish failed')
    expect(mocks.updateMock).toHaveBeenCalledTimes(2)
  })

  it('throws not found when docs status is requested for missing repo', async () => {
    const { dbService } = createDbMocks([[]])
    const service = new DocsService(dbService as never)

    await expect(service.getDocumentationStatus(5, 50)).rejects.toBeInstanceOf(NotFoundException)
  })
})
