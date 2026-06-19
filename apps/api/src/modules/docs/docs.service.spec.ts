import { ConflictException, NotFoundException } from '@nestjs/common'
import { RepoDocsGenerationScope, RepoDocsSectionKey } from '@workspace/codepath-common/repository'

import { DocsService } from './services/docs.service'

jest.mock('../telemetry/services/telemetry', () => ({
  emitTelemetry: jest.fn()
}))

type RepoState = {
  cloneStatus: 'cloned' | 'cloning' | 'failed' | 'pending'
  documentation?: string | null
  docsStatus: 'failed' | 'pending' | 'processing' | 'ready'
  embeddingStatus: 'embedded' | 'failed' | 'pending' | 'processing'
  id: number
  pipelineUpdatedAt?: string | null
}

function createDbMocks(
  selectResults: unknown[],
  updateReturningRows: unknown[] = [{ id: 1 }],
  fragmentResults: unknown[][] = []
) {
  const limitMock = jest.fn()
  for (const result of selectResults) {
    limitMock.mockResolvedValueOnce(result)
  }
  const orderByMock = jest.fn()
  for (const result of fragmentResults) {
    orderByMock.mockResolvedValueOnce(result)
  }

  const selectWhereMock = jest.fn(() => ({
    limit: limitMock,
    orderBy: orderByMock
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
  const deleteWhereMock = jest.fn().mockResolvedValue(undefined)
  const deleteMock = jest.fn(() => ({
    where: deleteWhereMock
  }))
  const insertOnConflictDoUpdateMock = jest.fn().mockResolvedValue(undefined)
  const insertValuesMock = jest.fn(() => ({
    onConflictDoUpdate: insertOnConflictDoUpdateMock
  }))
  const insertMock = jest.fn(() => ({
    values: insertValuesMock
  }))

  return {
    dbService: {
      dbClient: {
        delete: deleteMock,
        insert: insertMock,
        select: selectMock,
        update: updateMock
      }
    },
    mocks: {
      limitMock,
      returningMock,
      deleteMock,
      deleteWhereMock,
      insertMock,
      insertOnConflictDoUpdateMock,
      insertValuesMock,
      orderByMock,
      selectMock,
      updateMock,
      updateSetMock,
      updateWhereMock
    }
  }
}

describe('DocsService', () => {
  const orchestratorClient = {
    enqueueDocsJob: jest.fn()
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    orchestratorClient.enqueueDocsJob.mockReset()
  })

  it('throws when repository clone is not ready', async () => {
    const repoState: RepoState = {
      cloneStatus: 'pending',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 10
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.generateDocumentation(1, 10)).rejects.toBeInstanceOf(ConflictException)
    expect(orchestratorClient.enqueueDocsJob).not.toHaveBeenCalled()
  })

  it('returns already processing response when docs job is in progress', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'processing',
      embeddingStatus: 'embedded',
      id: 20
    }
    const { dbService, mocks } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.generateDocumentation(2, 20)).resolves.toEqual({
      message: 'Documentation generation already in progress',
      status: 'processing'
    })
    expect(mocks.updateMock).not.toHaveBeenCalled()
    expect(orchestratorClient.enqueueDocsJob).not.toHaveBeenCalled()
  })

  it('throws actionable message when embeddings are still processing', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'processing',
      id: 25
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.generateDocumentation(2, 25)).rejects.toThrow(
      'Embeddings are still processing. Wait for completion before generating documentation.'
    )
    expect(orchestratorClient.enqueueDocsJob).not.toHaveBeenCalled()
  })

  it('throws actionable message when embeddings failed', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'failed',
      id: 26
    }
    const { dbService } = createDbMocks([[repoState]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.generateDocumentation(2, 26)).rejects.toThrow(
      'Embeddings failed. Re-run embedding before generating documentation.'
    )
    expect(orchestratorClient.enqueueDocsJob).not.toHaveBeenCalled()
  })

  it('claims docs processing and publishes docs job', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 30
    }
    const { dbService } = createDbMocks([[repoState]], [{ id: 30 }])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    orchestratorClient.enqueueDocsJob.mockResolvedValue(undefined)

    await expect(service.generateDocumentation(3, 30)).resolves.toEqual({
      message: 'Documentation generation started',
      status: 'processing'
    })
    expect(orchestratorClient.enqueueDocsJob).toHaveBeenCalledWith({
      forceRegenerateDocs: true,
      repoId: 30,
      scope: RepoDocsGenerationScope.REPOSITORY
    })
  })

  it('publishes scoped docs job for a selected module', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'ready',
      embeddingStatus: 'embedded',
      id: 31
    }
    const { dbService, mocks } = createDbMocks([[repoState]], [{ id: 31 }])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    orchestratorClient.enqueueDocsJob.mockResolvedValue(undefined)

    await expect(service.generateDocumentation(3, 31, { moduleKey: 'src_modules_users' })).resolves.toEqual({
      message: 'Documentation generation started',
      status: 'processing'
    })
    expect(orchestratorClient.enqueueDocsJob).toHaveBeenCalledWith({
      forceRegenerateDocs: true,
      moduleKey: 'src_modules_users',
      repoId: 31,
      scope: RepoDocsGenerationScope.MODULE
    })
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      fragmentKey: '__module_summary__',
      fragmentType: 'module_summary',
      moduleKey: 'src_modules_users',
      moduleTitle: 'Users',
      status: 'processing'
    }))
  })

  it('publishes scoped docs job for a selected section and creates processing placeholder', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'ready',
      embeddingStatus: 'embedded',
      id: 32
    }
    const { dbService, mocks } = createDbMocks([[repoState]], [{ id: 32 }])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    orchestratorClient.enqueueDocsJob.mockResolvedValue(undefined)

    await expect(service.generateDocumentation(3, 32, { moduleKey: 'src_modules_users', sectionKey: RepoDocsSectionKey.TESTING })).resolves.toEqual({
      message: 'Documentation generation started',
      status: 'processing'
    })
    expect(orchestratorClient.enqueueDocsJob).toHaveBeenCalledWith({
      forceRegenerateDocs: true,
      moduleKey: 'src_modules_users',
      repoId: 32,
      scope: RepoDocsGenerationScope.SECTION,
      sectionKey: 'testing'
    })
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      fragmentKey: 'testing',
      fragmentType: 'section',
      moduleKey: 'src_modules_users',
      sectionKey: 'testing',
      sectionTitle: 'Testing',
      status: 'processing'
    }))
  })

  it('marks docs as failed when publish throws', async () => {
    const repoState: RepoState = {
      cloneStatus: 'cloned',
      docsStatus: 'pending',
      embeddingStatus: 'embedded',
      id: 40
    }
    const { dbService, mocks } = createDbMocks([[repoState]], [{ id: 40 }])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    orchestratorClient.enqueueDocsJob.mockRejectedValue(new Error('publish failed'))

    await expect(service.generateDocumentation(4, 40)).rejects.toThrow('publish failed')
    expect(mocks.updateMock).toHaveBeenCalledTimes(2)
  })

  it('throws not found when docs status is requested for missing repo', async () => {
    const { dbService } = createDbMocks([[]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.getDocumentationStatus(5, 50)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('returns documentation status with normalized progress details', async () => {
    const { dbService } = createDbMocks([[
      {
        cloneStatus: 'cloned',
        docsProgressCurrent: 4,
        docsProgressMessage: 'Generating summary for users.service.ts',
        docsProgressModuleKey: 'src_modules_users',
        docsProgressScope: 'section',
        docsProgressSectionKey: 'testing',
        docsProgressStage: 'file_summaries',
        docsProgressTotal: 10,
        docsProgressUpdatedAt: '2026-06-13T10:00:00.000Z',
        docsStatus: 'processing',
        embeddingStatus: 'embedded',
        id: 51,
        lastPipelineError: null,
        pipelineUpdatedAt: '2026-06-13T10:00:00.000Z'
      }
    ]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    await expect(service.getDocumentationStatus(5, 51)).resolves.toEqual({
      cloneStatus: 'cloned',
      docsProgress: {
        current: 4,
        message: 'Generating summary for users.service.ts',
        moduleKey: 'src_modules_users',
        scope: 'section',
        sectionKey: 'testing',
        stage: 'file_summaries',
        total: 10,
        updatedAt: '2026-06-13T10:00:00.000Z'
      },
      docsStatus: 'processing',
      embeddingStatus: 'embedded',
      id: 51,
      lastPipelineError: null,
      pipelineUpdatedAt: '2026-06-13T10:00:00.000Z'
    })
  })

  it('returns stored documentation modules with sections in canonical order', async () => {
    const { dbService } = createDbMocks([[
      {
        docsStatus: 'ready',
        documentation: null,
        id: 60,
        pipelineUpdatedAt: '2026-06-12T10:00:00.000Z'
      }
    ]], [{ id: 1 }], [[
      {
        error: null,
        fragmentKey: '__module_summary__',
        fragmentType: 'module_summary',
        generatedAt: '2026-06-12T10:00:00.000Z',
        id: 1,
        markdown: 'User management.',
        moduleKey: 'users',
        modulePath: 'src/modules/users',
        moduleTitle: 'Users',
        repoId: 60,
        sectionKey: null,
        sectionTitle: null,
        status: 'ready'
      },
      {
        error: null,
        fragmentKey: 'testing',
        fragmentType: 'section',
        generatedAt: '2026-06-12T10:00:00.000Z',
        id: 2,
        markdown: '## Testing\nTests.',
        moduleKey: 'users',
        modulePath: 'src/modules/users',
        moduleTitle: 'Users',
        repoId: 60,
        sectionKey: 'testing',
        sectionTitle: 'Testing',
        status: 'ready'
      },
      {
        error: null,
        fragmentKey: 'overview',
        fragmentType: 'section',
        generatedAt: '2026-06-12T10:00:00.000Z',
        id: 3,
        markdown: '## Overview\nOverview.',
        moduleKey: 'users',
        modulePath: 'src/modules/users',
        moduleTitle: 'Users',
        repoId: 60,
        sectionKey: 'overview',
        sectionTitle: 'Overview',
        status: 'ready'
      }
    ]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    const modules = await service.getDocumentationModules(6, 60)

    expect(modules).toHaveLength(1)
    expect(modules[0]).toMatchObject({ key: 'users', path: 'src/modules/users', title: 'Users' })
    expect(modules[0].sections).toHaveLength(9)
    expect(modules[0].sections[0]).toMatchObject({ key: 'overview', markdown: '## Overview\nOverview.', status: 'ready' })
    expect(modules[0].sections[7]).toMatchObject({ key: 'testing', markdown: '## Testing\nTests.', status: 'ready' })
  })

  it('returns fragment-backed module with pending missing sections', async () => {
    const { dbService } = createDbMocks([[
      {
        docsStatus: 'ready',
        documentation: null,
        id: 60,
        pipelineUpdatedAt: '2026-06-12T10:00:00.000Z'
      }
    ]], [{ id: 1 }], [[
      {
        error: null,
        fragmentKey: 'overview',
        fragmentType: 'section',
        generatedAt: '2026-06-12T10:00:00.000Z',
        id: 1,
        markdown: '## Overview\nOverview.',
        moduleKey: 'repository',
        modulePath: null,
        moduleTitle: 'Repository',
        repoId: 60,
        sectionKey: 'overview',
        sectionTitle: 'Overview',
        status: 'ready'
      }
    ]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    const modules = await service.getDocumentationModules(6, 60)

    expect(modules).toHaveLength(1)
    expect(modules[0]).toMatchObject({ key: 'repository', title: 'Repository' })
    expect(modules[0].sections[0]).toMatchObject({ key: 'overview', markdown: '## Overview\nOverview.', status: 'ready' })
    expect(modules[0].sections[1]).toMatchObject({ key: 'architecture', markdown: null, status: 'pending' })
  })

  it('derives repository documentation module from legacy markdown when jsonb modules are missing', async () => {
    const { dbService } = createDbMocks([[
      {
        docsStatus: 'ready',
        documentation: [
          '# Project Overview',
          'Project summary.',
          '## Architecture',
          'Module layout.',
          '## API Reference',
          'GET /users.',
          '## Test Coverage',
          'Unit tests.'
        ].join('\n'),
        id: 61,
        pipelineUpdatedAt: '2026-06-12T11:00:00.000Z'
      }
    ]], [{ id: 1 }], [[]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    const modules = await service.getDocumentationModules(6, 61)
    const sections = modules[0].sections

    expect(modules).toHaveLength(1)
    expect(modules[0]).toMatchObject({ key: 'repository', status: 'ready', title: 'Repository' })
    expect(sections.find(section => section.key === 'overview')).toMatchObject({
      generatedAt: '2026-06-12T11:00:00.000Z',
      markdown: expect.stringContaining('Project summary.'),
      status: 'ready'
    })
    expect(sections.find(section => section.key === 'public_interfaces')?.markdown).toContain('GET /users.')
    expect(sections.find(section => section.key === 'testing')?.markdown).toContain('Unit tests.')
  })

  it('returns pending section skeleton when docs are not generated', async () => {
    const { dbService } = createDbMocks([[
      {
        docsStatus: 'pending',
        documentation: null,
        id: 62,
        pipelineUpdatedAt: null
      }
    ]], [{ id: 1 }], [[]])
    const service = new DocsService(dbService as never, orchestratorClient as never)

    const modules = await service.getDocumentationModules(6, 62)
    const sections = modules[0].sections

    expect(modules).toHaveLength(1)
    expect(modules[0]).toMatchObject({ key: 'repository', status: 'pending' })
    expect(sections).toHaveLength(9)
    expect(sections.every(section => section.status === 'pending')).toBe(true)
    expect(sections.map(section => section.key)).toEqual([
      'overview',
      'architecture',
      'key_components',
      'data_flow',
      'public_interfaces',
      'configuration',
      'operations',
      'testing',
      'risks_limitations'
    ])
  })
})
