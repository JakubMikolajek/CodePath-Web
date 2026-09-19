import { DashboardService } from './dashboard.service'

type QueryResult = unknown[]

describe('DashboardService', () => {
  afterEach(() => jest.restoreAllMocks())

  it('returns an empty user summary with seven zero-filled UTC days and does not query Qdrant', async () => {
    const { qdrantService, service } = createService([[], [{ total: 0 }], [], []])
    setNow(service, '2026-09-19T13:30:00.000Z')

    await expect(service.getSummary(1)).resolves.toEqual({
      aiSessionsThisMonth: 0,
      aiUsage: {
        daily: [
          { date: '2026-09-13', requests: 0 },
          { date: '2026-09-14', requests: 0 },
          { date: '2026-09-15', requests: 0 },
          { date: '2026-09-16', requests: 0 },
          { date: '2026-09-17', requests: 0 },
          { date: '2026-09-18', requests: 0 },
          { date: '2026-09-19', requests: 0 }
        ],
        total: 0
      },
      apiEndpoints: 0,
      recentActivity: [],
      recentChats: [],
      repositories: 0
    })
    expect(qdrantService.count).not.toHaveBeenCalled()
  })

  it('keeps repositories, sessions, messages, chats and activity scoped to the authenticated user', async () => {
    const { qdrantService, service } = createService([
      [repo({ cloneStatus: 'cloned', id: 1, name: 'Owned repo' })],
      [{ total: 2 }],
      [{ date: '2026-09-19', requests: 3 }],
      [chat({ id: 'owned-session', name: 'Owned chat', repoId: 1 })]
    ], { count: jest.fn().mockResolvedValue({ count: 9 }) })
    setNow(service, '2026-09-19T13:30:00.000Z')

    const summary = await service.getSummary(7)

    expect(summary).toMatchObject({
      aiSessionsThisMonth: 2,
      apiEndpoints: 9,
      recentChats: [{ id: 'owned-session', name: 'Owned chat', repoId: 1 }],
      repositories: 1
    })
    expect(summary.aiUsage.total).toBe(3)
    expect(summary.recentActivity).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Owned repo' }),
      expect.objectContaining({ title: 'Owned chat' })
    ]))
    expect(qdrantService.count).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      must: [expect.objectContaining({ key: 'repo_id', match: { any: [1] } })]
    }))
  })

  it('uses UTC month and seven-day boundaries while preserving zero-filled days', async () => {
    const { service } = createService([
      [repo()],
      [{ total: 1 }],
      [
        { date: '2026-09-13', requests: 1 },
        { date: '2026-09-19', requests: 2 }
      ],
      []
    ])
    setNow(service, '2026-09-19T00:01:00.000Z')

    const summary = await service.getSummary(1)

    expect(summary.aiSessionsThisMonth).toBe(1)
    expect(summary.aiUsage).toEqual({
      daily: [
        { date: '2026-09-13', requests: 1 },
        { date: '2026-09-14', requests: 0 },
        { date: '2026-09-15', requests: 0 },
        { date: '2026-09-16', requests: 0 },
        { date: '2026-09-17', requests: 0 },
        { date: '2026-09-18', requests: 0 },
        { date: '2026-09-19', requests: 2 }
      ],
      total: 3
    })
  })

  it('returns chats in database order and uses the session creation timestamp when no message exists', async () => {
    const { service } = createService([
      [repo()],
      [{ total: 0 }],
      [],
      [
        chat({ id: 'latest', lastMessageAt: '2026-09-18T12:00:00.000Z', sessionCreatedAt: '2026-09-01T12:00:00.000Z' }),
        chat({ id: 'fallback', lastMessageAt: '2026-09-17T12:00:00.000Z', sessionCreatedAt: '2026-09-17T12:00:00.000Z' })
      ]
    ])

    const summary = await service.getSummary(1)

    expect(summary.recentChats).toEqual([
      expect.objectContaining({ id: 'latest', lastMessageAt: '2026-09-18T12:00:00.000Z' }),
      expect.objectContaining({ id: 'fallback', lastMessageAt: '2026-09-17T12:00:00.000Z' })
    ])
  })

  it('merges and limits activity to the four newest derived repo and session events', async () => {
    const { service } = createService([
      [
        repo({ cloneStatus: 'cloned', name: 'Clone', pipelineUpdatedAt: '2026-09-14T00:00:00.000Z' }),
        repo({ embeddingStatus: 'embedded', name: 'Embedded', pipelineUpdatedAt: '2026-09-17T00:00:00.000Z' }),
        repo({ docsStatus: 'ready', name: 'Docs', pipelineUpdatedAt: '2026-09-18T00:00:00.000Z' })
      ],
      [{ total: 0 }],
      [],
      [
        chat({ id: 'chat-new', name: 'New chat', sessionCreatedAt: '2026-09-19T00:00:00.000Z' }),
        chat({ id: 'chat-old', name: 'Old chat', sessionCreatedAt: '2026-09-15T00:00:00.000Z' })
      ]
    ])

    const summary = await service.getSummary(1)

    expect(summary.recentActivity).toEqual([
      expect.objectContaining({ kind: 'chat_started', title: 'New chat' }),
      expect.objectContaining({ kind: 'docs_ready', title: 'Docs' }),
      expect.objectContaining({ kind: 'repo_embedded', title: 'Embedded' }),
      expect.objectContaining({ kind: 'chat_started', title: 'Old chat' })
    ])
  })

  it('returns the SQL summary when Qdrant counting fails', async () => {
    const { service } = createService([
      [repo()],
      [{ total: 1 }],
      [{ date: '2026-09-19', requests: 1 }],
      []
    ], { count: jest.fn().mockRejectedValue(new Error('Qdrant unavailable')) })
    setNow(service, '2026-09-19T13:30:00.000Z')

    const summary = await service.getSummary(1)

    expect(summary.apiEndpoints).toBeNull()
    expect(summary.repositories).toBe(1)
    expect(summary.aiSessionsThisMonth).toBe(1)
    expect(summary.aiUsage.total).toBe(1)
  })
})

function createService(results: QueryResult[], qdrantService = { count: jest.fn().mockResolvedValue({ count: 0 }) }) {
  const dbClient = {
    select: jest.fn(() => queryBuilder(results.shift() ?? []))
  }

  return {
    qdrantService,
    service: new DashboardService({ dbClient } as never, qdrantService as never)
  }
}

function queryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder

  Object.assign(builder, {
    from: jest.fn(chain),
    groupBy: jest.fn(chain),
    leftJoin: jest.fn(chain),
    limit: jest.fn(chain),
    orderBy: jest.fn(chain),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    where: jest.fn(chain)
  })

  return builder
}

function repo(overrides: Partial<{
  cloneStatus: string
  docsStatus: string
  embeddingStatus: string
  id: number
  name: string
  pipelineUpdatedAt: string
}> = {}) {
  return {
    cloneStatus: 'pending',
    docsStatus: 'pending',
    embeddingStatus: 'pending',
    id: 1,
    name: 'Repository',
    pipelineUpdatedAt: '2026-09-16T00:00:00.000Z',
    ...overrides
  }
}

function chat(overrides: Partial<{
  id: string
  lastMessageAt: string
  name: null | string
  repoId: number
  sessionCreatedAt: string
}> = {}) {
  return {
    id: 'session-1',
    lastMessageAt: '2026-09-16T00:00:00.000Z',
    name: 'Chat',
    repoId: 1,
    sessionCreatedAt: '2026-09-16T00:00:00.000Z',
    ...overrides
  }
}

function setNow(service: DashboardService, value: string) {
  jest.spyOn(service as never, 'now').mockReturnValue(new Date(value))
}
