import { NotFoundException } from '@nestjs/common'
import {
  OpenApiVersion,
  RepoOpenApiParameterIn,
  RepoOpenApiSourceMode
} from '@workspace/codepath-common/api-explorer'

import { ApiExplorerService } from './services/api-explorer.service'
import { ApiRunnerService } from './services/api-runner.service'

const httpClient = {
  request: jest.fn()
}

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

function createService(dbService: unknown, qdrantService: unknown) {
  const runnerAuthPresetsRepository = {
    delete: jest.fn(),
    list: jest.fn(),
    save: jest.fn()
  }
  const runnerCollectionsRepository = {
    delete: jest.fn(),
    list: jest.fn(),
    save: jest.fn()
  }

  const runnerService = new ApiRunnerService(
    runnerAuthPresetsRepository as never,
    runnerCollectionsRepository as never,
    httpClient as never
  )

  return new ApiExplorerService(
    dbService as never,
    qdrantService as never,
    runnerService as never,
    httpClient as never
  )
}

describe('ApiExplorerService', () => {
  beforeEach(() => {
    httpClient.request.mockReset()
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
    const service = createService(dbService, qdrantService)

    const response = await service.getRepoInteractiveApi(1, 10, {})
    const methodsAndPaths = response.endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`)

    expect(methodsAndPaths).toContain('GET /users')
    expect(methodsAndPaths).toContain('GET /users/:id')
    expect(methodsAndPaths).toContain('POST /users')
    const detailEndpoint = response.endpoints.find(endpoint => endpoint.method === 'GET' && endpoint.path === '/users/:id')
    expect(detailEndpoint?.sourceSnippet).toContain("@Get(':id')")
    expect(detailEndpoint?.sourceSnippet).not.toContain('@Post()')
    expect(detailEndpoint?.sourceLineStart).toBeGreaterThan(0)
    expect(response.metadata.endpointCount).toBe(3)
    expect(response.metadata.frameworks).toContain('nestjs')
    expect(response.metadata.endpointDistributionByFramework.nestjs).toBe(3)
    expect(response.metadata.endpointDistributionByMethod.GET).toBe(2)
    expect(response.metadata.endpointDistributionByMethod.POST).toBe(1)
    expect(response.metadata.endpointsWithSourceSnippet).toBe(3)
    expect(response.metadata.sourceSnippetCoverage).toBe(1)
    expect(response.metadata.endpointsWithRequestBodyModel).toBe(0)
    expect(response.metadata.requestBodyModelCoverage).toBe(0)
    const expectedAverage = Number((
      response.endpoints.reduce((sum, endpoint) => sum + endpoint.params.length, 0) / response.endpoints.length
    ).toFixed(4))
    expect(response.metadata.avgParamsPerEndpoint).toBe(expectedAverage)
    expect(response.metadata.moduleCount).toBeGreaterThan(0)
    expect(response.metadata.modules).toHaveLength(response.metadata.moduleCount)
  })

  it('does not leak next NestJS route decorator into endpoint snippet', async () => {
    const { dbService } = createDbMocks({ id: 11, name: 'repo-nest-snippet-boundary' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                @Controller('admin')
                export class ApiConfigController {
                  @Post('change-password')
                  changePassword(@Body() body: ChangePasswordDto) {
                    return this.apiConfig.changePassword(body)
                  }

                  @Post('update-api-key')
                  updateApiKey(@Body() body: UpdateApiKeyDto) {
                    return this.apiConfig.updateApi(body)
                  }
                }
              `,
              file_ext: '.ts',
              file_path: 'backend/src/modules/apiConfig/api-config.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = createService(dbService, qdrantService)

    const response = await service.getRepoInteractiveApi(1, 11, {})
    const changePasswordEndpoint = response.endpoints.find(
      endpoint => endpoint.method === 'POST' && endpoint.path === '/admin/change-password'
    )

    expect(changePasswordEndpoint).toBeDefined()
    expect(changePasswordEndpoint?.sourceSnippet).toContain("@Post('change-password')")
    expect(changePasswordEndpoint?.sourceSnippet).not.toContain("@Post('update-api-key')")
    expect(changePasswordEndpoint?.sourceSnippet).not.toContain('updateApiKey(')
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
    const service = createService(dbService, qdrantService)

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
    const service = createService(dbService, qdrantService)

    const spec = await service.getRepoOpenApiSpec(1, 30, {})

    expect(spec.openapi).toBe(OpenApiVersion.V3_1_0)
    expect(spec.info.title).toContain('repo-gamma')
    expect(spec.paths['/users/{id}']?.get).toBeDefined()
    expect(spec.paths['/users']?.post?.requestBody).toBeDefined()
    expect(spec.paths['/users/{id}']?.get?.parameters?.some(param => param.in === RepoOpenApiParameterIn.PATH && param.name === 'id')).toBe(true)
    expect(spec['x-codepath-metrics']).toMatchObject({
      codeSourceCoverage: 1,
      mergedOperationCount: 2,
      moduleTagCount: 1,
      operationCount: 2,
      operationsWithCodeSource: 2,
      runtimeOperationCount: 0,
      schemaComponentCount: 0,
      sourceMode: RepoOpenApiSourceMode.STATIC,
      staticOperationCount: 2
    })
  })

  it('groups OpenAPI tags by module and references DTO schema when inferred', async () => {
    const { dbService } = createDbMocks({ id: 32, name: 'repo-dto' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                export class CreateUserDto {
                  email: string
                  age?: number
                }

                @Controller('users')
                export class UsersController {
                  @Post()
                  create(@Body() payload: CreateUserDto) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/modules/users/users.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = createService(dbService, qdrantService)

    const spec = await service.getRepoOpenApiSpec(1, 32, {})
    const requestBodySchema = spec.paths['/users']?.post?.requestBody?.content['application/json']?.schema

    expect(spec.tags?.some(tag => tag.name === 'users')).toBe(true)
    expect(spec.components?.schemas?.CreateUserDto).toBeDefined()
    expect(requestBodySchema).toEqual({ $ref: '#/components/schemas/CreateUserDto' })
    expect(spec['x-codepath-metrics']?.schemaComponentCount).toBeGreaterThanOrEqual(1)
    expect(spec['x-codepath-metrics']?.sourceMode).toBe(RepoOpenApiSourceMode.STATIC)
  })

  it('infers request DTO for Optional/union Nest body type', async () => {
    const { dbService } = createDbMocks({ id: 35, name: 'repo-nest-optional' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                export class CreateOrderDto {
                  amount: number
                }

                @Controller('orders')
                export class OrdersController {
                  @Post()
                  create(@Body() payload: CreateOrderDto | null) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/modules/orders/orders.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = createService(dbService, qdrantService)

    const spec = await service.getRepoOpenApiSpec(1, 35, {})
    const requestBodySchema = spec.paths['/orders']?.post?.requestBody?.content['application/json']?.schema

    expect(spec.components?.schemas?.CreateOrderDto).toBeDefined()
    expect(requestBodySchema).toEqual({ $ref: '#/components/schemas/CreateOrderDto' })
    expect(spec['x-codepath-metrics']).toMatchObject({
      codeSourceCoverage: 1,
      mergedOperationCount: 1,
      operationCount: 1,
      operationsWithCodeSource: 1,
      sourceMode: RepoOpenApiSourceMode.STATIC,
      staticOperationCount: 1
    })
  })

  it('rejects runtime OpenAPI base URL outside localhost/private LAN', async () => {
    const { dbService } = createDbMocks({ id: 36, name: 'repo-runtime-url-guard' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: []
      })
    }
    const service = createService(dbService, qdrantService)

    await expect(service.getRepoOpenApiSpec(1, 36, {
      runtimeBaseUrl: 'https://example.com'
    })).rejects.toThrow('runtimeBaseUrl must be localhost or private LAN')
  })

  it('prefers runtime OpenAPI and enriches operations with static code metadata', async () => {
    const { dbService } = createDbMocks({ id: 33, name: 'repo-runtime-first' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                @Controller('users')
                export class UsersController {
                  @Get(':id')
                  detail(@Param('id') id: string) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/modules/users/users.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = createService(dbService, qdrantService)

    httpClient.request.mockResolvedValue({
      data: {
        info: {
          title: 'Runtime API',
          version: '1.0.0'
        },
        openapi: '3.0.0',
        paths: {
          '/api/users/{id}': {
            get: {
              operationId: 'UsersController_detail',
              responses: {
                '200': {
                  description: 'ok'
                }
              },
              summary: 'GET /api/users/{id}',
              tags: ['Users']
            }
          }
        }
      },
      status: 200
    } as never)

    const spec = await service.getRepoOpenApiSpec(1, 33, {
      runtimeBaseUrl: 'http://127.0.0.1:3001'
    })

    const operation = spec.paths['/api/users/{id}']?.get
    expect(spec.info.title).toBe('Runtime API')
    expect(operation).toBeDefined()
    expect(operation?.['x-codepath']).toBeDefined()
    expect(operation?.['x-codepath-sources']?.length).toBeGreaterThan(0)
    expect(spec['x-codepath-metrics']).toMatchObject({
      codeSourceCoverage: 1,
      mergedOperationCount: 1,
      operationCount: 1,
      operationsWithCodeSource: 1,
      runtimeOperationCount: 1,
      sourceMode: RepoOpenApiSourceMode.HYBRID,
      staticOperationCount: 1
    })
    expect(spec['x-codepath-metrics']?.runtimeResolvedUrl).toContain('/openapi.json')
  })

  it('falls back to static OpenAPI when runtime OpenAPI is unavailable', async () => {
    const { dbService } = createDbMocks({ id: 34, name: 'repo-runtime-fallback' })
    const qdrantService = {
      scroll: jest.fn().mockResolvedValue({
        points: [
          {
            payload: {
              content: `
                @Controller('users')
                export class UsersController {
                  @Get(':id')
                  detail(@Param('id') id: string) {}
                }
              `,
              file_ext: '.ts',
              file_path: 'apps/api/src/modules/users/users.controller.ts',
              language: 'typescript',
              message_type: 'ingest.batch.ready'
            }
          }
        ]
      })
    }
    const service = createService(dbService, qdrantService)

    httpClient.request.mockRejectedValue(new Error('timeout'))

    const spec = await service.getRepoOpenApiSpec(1, 34, {
      runtimeBaseUrl: 'http://127.0.0.1:3001'
    })

    expect(spec.info.title).toContain('repo-runtime-fallback')
    expect(spec.paths['/users/{id}']?.get).toBeDefined()
    expect(spec['x-codepath-metrics']).toMatchObject({
      runtimeOperationCount: 0,
      sourceMode: RepoOpenApiSourceMode.STATIC,
      staticOperationCount: 1
    })
  })

  it('rejects runner calls to public internet URLs', async () => {
    const { dbService } = createDbMocks({ id: 40, name: 'repo-runner' })
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = createService(dbService, qdrantService)

    await expect(service.runApiRequest(1, 40, {
      method: 'GET',
      url: 'https://example.com/api/health'
    })).rejects.toThrow('localhost or private LAN')

    expect(httpClient.request).not.toHaveBeenCalled()
  })

  it('executes runner call for localhost URL', async () => {
    const { dbService } = createDbMocks({ id: 41, name: 'repo-runner-local' })
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = createService(dbService, qdrantService)

    httpClient.request.mockResolvedValue({
      data: Buffer.from(JSON.stringify({ ok: true }), 'utf8'),
      headers: {
        'content-type': 'application/json'
      },
      status: 200,
      statusText: 'OK'
    } as never)

    const response = await service.runApiRequest(1, 41, {
      body: { hello: 'world' },
      headers: {
        'X-Test': '1'
      },
      method: 'POST',
      timeoutMs: 2500,
      url: 'http://127.0.0.1:4000/api/test'
    })

    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ ok: true })
    expect(httpClient.request).toHaveBeenCalledTimes(1)
  })

  it('throws not found when repo does not belong to user', async () => {
    const { dbService } = createDbMocks(null)
    const qdrantService = {
      scroll: jest.fn()
    }
    const service = createService(dbService, qdrantService)

    await expect(service.getRepoInteractiveApi(123, 999, {})).rejects.toBeInstanceOf(NotFoundException)
  })
})
