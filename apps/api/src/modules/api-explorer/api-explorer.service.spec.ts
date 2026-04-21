import { NotFoundException } from '@nestjs/common'
import axios from 'axios'

import { ApiExplorerService } from './api-explorer.service'

jest.mock('axios')

function createDbMocks(repo: null | { id: number, name: string }) {
  const limitMock = jest.fn().mockResolvedValue(repo ? [repo] : [])
  const whereMock = jest.fn(() => ({
    limit: limitMock
  }))
  const fromMock = jest.fn(() => ({
    where: whereMock
  }))
  const selectMock = jest.fn(() => ({
    from: fromMock
  }))

  return {
    dbService: {
      dbClient: {
        select: selectMock
      }
    },
    mocks: {
      selectMock
    }
  }
}

describe('ApiExplorerService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('extracts NestJS endpoints from qdrant segments', async () => {
    const { dbService } = createDbMocks({ id: 10, name: 'repo-alpha' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                @Controller('users')
                export class UsersController {
                  @Get()
                  list() {}

                  @Get(':id')
                  detail(@Param('id') id: string, @Query('verbose') verbose?: string) {}

                  @Post()
                  create(@Body() body: unknown) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/users.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    const response = await service.getRepoInteractiveApi(1, 10, {})
    const methodsAndPaths = response.endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`)

    expect(methodsAndPaths).toContain('GET /users')
    expect(methodsAndPaths).toContain('GET /users/:id')
    expect(methodsAndPaths).toContain('POST /users')
    expect(response.metadata.endpointCount).toBe(3)
    expect(response.metadata.frameworks).toContain('nestjs')
  })

  it('applies method filters to detected endpoints', async () => {
    const { dbService } = createDbMocks({ id: 20, name: 'repo-beta' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                const router = Router()
                router.get('/users', handler)
                router.post('/users', handler)
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/routes/users.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    const response = await service.getRepoInteractiveApi(1, 20, {
      methods: 'POST'
    })

    expect(response.endpoints).toHaveLength(1)
    expect(response.endpoints[0]?.method).toBe('POST')
    expect(response.endpoints[0]?.path).toBe('/users')
  })

  it('builds OpenAPI JSON from detected endpoints', async () => {
    const { dbService } = createDbMocks({ id: 30, name: 'repo-gamma' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                @Controller('users')
                export class UsersController {
                  @Get(':id')
                  detail(@Param('id') id: string, @Query('verbose') verbose?: string) {}

                  @Post()
                  create(@Body() body: unknown) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/users.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    const spec = await service.getRepoOpenApiSpec(1, 30, {})

    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toContain('repo-gamma')
    expect(spec.paths['/users/{id}']?.get).toBeDefined()
    expect(spec.paths['/users']?.post?.requestBody).toBeDefined()
    expect(spec.paths['/users/{id}']?.get?.parameters?.some(param => param.in === 'path' && param.name === 'id')).toBe(true)
  })

  it('rejects runner calls to public internet URLs', async () => {
    const { dbService } = createDbMocks({ id: 40, name: 'repo-runner' })
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    await expect(service.runApiRequest(1, 40, {
      method: 'GET',
      url: 'https://example.com/api/health'
    })).rejects.toThrow('localhost or private LAN')

    expect(axios.request).not.toHaveBeenCalled()
  })

  it('executes runner call for localhost URL', async () => {
    const { dbService } = createDbMocks({ id: 41, name: 'repo-runner-local' })
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    jest.mocked(axios.request).mockResolvedValue({
      data: Buffer.from(JSON.stringify({ ok: true }), 'utf8'),
      headers: {
        'content-type': 'application/json'
      },
      status: 200,
      statusText: 'OK'
    } as never)

    const response = await service.runApiRequest(1, 41, {
      method: 'POST',
      url: 'http://127.0.0.1:4000/api/test',
      body: { hello: 'world' },
      headers: {
        'X-Test': '1'
      },
      timeoutMs: 2500
    })

    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ ok: true })
    expect(axios.request).toHaveBeenCalledTimes(1)
  })

  it('throws not found when repo does not belong to user', async () => {
    const { dbService } = createDbMocks(null)
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = new ApiExplorerService(dbService as never, qdrantService as never)

    await expect(service.getRepoInteractiveApi(123, 999, {})).rejects.toBeInstanceOf(NotFoundException)
  })
})
