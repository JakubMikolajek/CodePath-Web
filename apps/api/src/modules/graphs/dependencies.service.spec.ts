import { DependenciesService } from './services/dependencies.service'

type RepoFixture = {
  id: number
  name: string
}

type SegmentFixture = {
  ast_path?: string[]
  category?: string
  content?: string
  end_line?: number
  file_ext?: string
  file_path: string
  http_method?: string
  import_specifiers?: string[]
  language?: string
  message_type?: string
  node_type?: string
  parent_symbol_name?: string
  parse_strategy?: string
  route_path?: string
  segment_id?: string
  start_line?: number
  symbol_kind?: string
  symbol_name?: string
}

function codeFile(filePath: string, content: string, extra: Partial<SegmentFixture> = {}): SegmentFixture {
  return {
    content,
    file_ext: extra.file_ext ?? '.ts',
    file_path: filePath,
    language: extra.language ?? 'typescript',
    message_type: extra.message_type ?? 'ingest.batch.ready',
    symbol_name: extra.symbol_name,
    ...extra
  }
}

function jsonFile(filePath: string, content: string): SegmentFixture {
  return {
    content,
    file_ext: '.json',
    file_path: filePath,
    language: 'json',
    message_type: 'ingest.batch.ready'
  }
}

function astSegment(filePath: string, symbolName: string, extra: Partial<SegmentFixture> = {}): SegmentFixture {
  return {
    ast_path: extra.ast_path ?? ['program', 'class_declaration', 'method_definition'],
    category: 'code',
    content: extra.content ?? 'return this.service.list()',
    end_line: extra.end_line ?? 24,
    file_ext: extra.file_ext ?? '.ts',
    file_path: filePath,
    language: extra.language ?? 'typescript',
    message_type: extra.message_type ?? 'ingest.batch.ready',
    node_type: extra.node_type ?? 'method_definition',
    parse_strategy: 'tree_sitter',
    segment_id: extra.segment_id ?? `seg-${symbolName}`,
    start_line: extra.start_line ?? 20,
    symbol_kind: extra.symbol_kind ?? 'endpoint',
    symbol_name: symbolName,
    ...extra
  }
}

function createDbServiceMock(repo: RepoFixture) {
  const limit = jest.fn().mockResolvedValue([repo])
  const where = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))

  return {
    dbClient: {
      select
    }
  } as never
}

function createQdrantServiceMock(segments: SegmentFixture[]) {
  const scroll = jest.fn().mockResolvedValue({
    next_page_offset: null,
    points: segments.map(payload => ({ payload }))
  })

  return {
    scroll
  } as never
}

function createService(repo: RepoFixture, segments: SegmentFixture[]) {
  return new DependenciesService(
    createDbServiceMock(repo),
    createQdrantServiceMock(segments)
  )
}

function nodeLabels(graph: Awaited<ReturnType<DependenciesService['getRepoInteractiveGraph']>>, type: string) {
  return graph.nodes
    .filter(node => node.type === type)
    .map(node => node.label)
    .sort()
}

describe('DependenciesService interactive graph topology resolution', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('groups turbo-like workspace files by package root and resolves relative, alias, and package-name imports', async () => {
    const repo = { id: 1, name: 'turbo-root' }
    const service = createService(repo, [
      jsonFile('/repo/package.json', JSON.stringify({
        name: 'turbo-root',
        private: true,
        workspaces: ['apps/*', 'packages/*']
      })),
      jsonFile('/repo/apps/api/package.json', JSON.stringify({
        name: '@workspace/api',
        private: true
      })),
      jsonFile('/repo/apps/api/tsconfig.json', JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@shared/*': ['../../../packages/shared/src/*']
          }
        }
      })),
      codeFile('/repo/apps/api/src/controllers/http.ts', `
        import { createUser } from '../services/user-service'
        import { formatName } from '@shared/format-name'
        import { Button } from '@workspace/ui/button'

        export function handleRequest() {
          createUser()
          formatName('demo')
          Button()
        }
      `),
      codeFile('/repo/apps/api/src/services/user-service.ts', `
        export function createUser() {
          return 'created'
        }
      `),
      jsonFile('/repo/apps/web/package.json', JSON.stringify({
        name: '@workspace/web',
        private: true
      })),
      codeFile('/repo/apps/web/src/app.ts', `
        import { Nav } from './components/nav'
        import { Button } from '@workspace/ui/button'

        export function App() {
          Nav()
          Button()
        }
      `),
      codeFile('/repo/apps/web/src/components/nav.ts', `
        export function Nav() {
          return 'nav'
        }
      `),
      jsonFile('/repo/packages/shared/package.json', JSON.stringify({
        name: '@shared',
        private: true
      })),
      codeFile('/repo/packages/shared/src/format-name.ts', `
        export function formatName(value: string) {
          return value.trim()
        }
      `),
      jsonFile('/repo/packages/ui/package.json', JSON.stringify({
        name: '@workspace/ui',
        private: true
      })),
      codeFile('/repo/packages/ui/src/button.ts', `
        export function Button() {
          return 'button'
        }
      `)
    ])

    const graph = await service.getRepoInteractiveGraph(7, repo.id, {
      includeSymbols: 'false'
    })

    expect(graph.metadata.includedSymbols).toBe(false)
    expect(graph.nodes.some(node => node.type === 'symbol')).toBe(false)

    const modules = nodeLabels(graph, 'module')
    expect(modules).toEqual(expect.arrayContaining([
      '@shared',
      '@workspace/api',
      '@workspace/ui',
      '@workspace/web',
      'turbo-root'
    ]))
    expect(modules).not.toContain('apps/api/src/controllers')
    expect(modules).not.toContain('apps/api/src/services')
    expect(modules).not.toContain('apps/web/src')

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'file:/repo/apps/api/src/controllers/http.ts',
        target: 'file:/repo/apps/api/src/services/user-service.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/apps/api/src/controllers/http.ts',
        target: 'file:/repo/packages/shared/src/format-name.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/apps/api/src/controllers/http.ts',
        target: 'file:/repo/packages/ui/src/button.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/apps/web/src/app.ts',
        target: 'file:/repo/apps/web/src/components/nav.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/apps/web/src/app.ts',
        target: 'file:/repo/packages/ui/src/button.ts',
        type: 'imports'
      })
    ]))

    expect(graph.metadata.availableEdgeTypes).toEqual(expect.arrayContaining(['imports', 'depends_on', 'owns']))
  })

  it('keeps api and web packages separated in a non-turbo monorepo and resolves workspace package imports', async () => {
    const repo = { id: 2, name: 'plain-root' }
    const service = createService(repo, [
      jsonFile('/repo/package.json', JSON.stringify({
        name: 'plain-root',
        private: true,
        workspaces: ['api', 'web', 'packages/*']
      })),
      jsonFile('/repo/api/package.json', JSON.stringify({
        name: '@plain/api',
        private: true
      })),
      codeFile('/repo/api/src/index.ts', `
        import { start } from './services/bootstrap'
        import { logger } from '@plain/web/logger'

        export function runApi() {
          start()
          logger('api')
        }
      `),
      codeFile('/repo/api/src/services/bootstrap.ts', `
        export function start() {
          return true
        }
      `),
      jsonFile('/repo/web/package.json', JSON.stringify({
        name: '@plain/web',
        private: true
      })),
      codeFile('/repo/web/src/logger.ts', `
        export function logger(message: string) {
          return message
        }
      `),
      codeFile('/repo/web/src/index.ts', `
        import { logger } from './logger'
        export function runWeb() {
          logger('web')
        }
      `)
    ])

    const graph = await service.getRepoInteractiveGraph(11, repo.id, {
      includeSymbols: 'false'
    })

    const modules = nodeLabels(graph, 'module')
    expect(modules).toEqual(expect.arrayContaining([
      '@plain/api',
      '@plain/web',
      'plain-root'
    ]))
    expect(modules).not.toContain('api/src')
    expect(modules).not.toContain('web/src')

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'file:/repo/api/src/index.ts',
        target: 'file:/repo/api/src/services/bootstrap.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/api/src/index.ts',
        target: 'file:/repo/web/src/logger.ts',
        type: 'imports'
      }),
      expect.objectContaining({
        source: 'file:/repo/web/src/index.ts',
        target: 'file:/repo/web/src/logger.ts',
        type: 'imports'
      })
    ]))

    expect(graph.metadata.availableEdgeTypes).toEqual(expect.arrayContaining(['imports', 'depends_on', 'owns']))
  })

  it('does not crash on malformed configs and keeps includeSymbols=false graphs stable', async () => {
    const repo = { id: 3, name: 'odd-config' }
    const service = createService(repo, [
      jsonFile('/repo/package.json', '{'),
      jsonFile('/repo/apps/web/package.json', JSON.stringify({
        name: '@odd/web',
        private: true
      })),
      jsonFile('/repo/apps/web/tsconfig.json', '{ "compilerOptions": { "paths": 123 } }'),
      codeFile('/repo/apps/web/src/page.ts', `
        import { helper } from '../lib/helper'

        export function renderPage() {
          return helper()
        }
      `),
      codeFile('/repo/apps/web/lib/helper.ts', `
        export function helper() {
          return 'help'
        }
      `)
    ])

    const graph = await service.getRepoInteractiveGraph(3, repo.id, {
      includeSymbols: 'false'
    })

    expect(graph.metadata.includedSymbols).toBe(false)
    expect(graph.metadata.truncated).toBeFalsy()
    expect(graph.nodes.some(node => node.type === 'symbol')).toBe(false)
    expect(graph.nodes.length).toBeGreaterThan(0)
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'file:/repo/apps/web/src/page.ts',
        target: 'file:/repo/apps/web/lib/helper.ts',
        type: 'imports'
      })
    ]))
  })

  it('filters out node_modules files and package imports from JS/TS graph noise', async () => {
    const repo = { id: 4, name: 'no-node-modules-noise' }
    const service = createService(repo, [
      codeFile('/repo/src/app.ts', `
        import lodash from 'lodash'
        import { helper } from './helper'

        export function run() {
          return helper() && lodash
        }
      `),
      codeFile('/repo/src/helper.ts', `
        export function helper() {
          return true
        }
      `),
      codeFile('/repo/node_modules/lodash/index.js', `
        export default {}
      `, {
        file_ext: '.js',
        language: 'javascript'
      })
    ])

    const graph = await service.getRepoInteractiveGraph(4, repo.id, {
      includeSymbols: 'false'
    })

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'file:/repo/src/app.ts',
        target: 'file:/repo/src/helper.ts',
        type: 'imports'
      })
    ]))

    expect(graph.nodes.some(node => node.label === '/repo/node_modules/lodash/index.js')).toBe(false)
    expect(graph.nodes.some(node => node.type === 'external_package' && node.label === 'lodash')).toBe(false)
    expect(graph.edges.some(edge => edge.metadata?.label === 'lodash')).toBe(false)
  })

  it('builds symbol and HTTP endpoint nodes from ingest.v2 semantic metadata without reparsing decorators from source text', async () => {
    const repo = { id: 5, name: 'semantic-graph' }
    const service = createService(repo, [
      astSegment('/repo/apps/api/src/users.controller.ts', 'listUsers', {
        content: 'return this.usersService.list()',
        http_method: 'GET',
        parent_symbol_name: 'UsersController',
        route_path: '/users',
        symbol_kind: 'endpoint'
      })
    ])

    const graph = await service.getRepoInteractiveGraph(5, repo.id, {
      includeSymbols: 'true'
    })

    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'symbol:/repo/apps/api/src/users.controller.ts:seg-listUsers',
        label: 'listUsers',
        metadata: expect.objectContaining({
          astPath: ['program', 'class_declaration', 'method_definition'],
          endLine: 24,
          filePath: '/repo/apps/api/src/users.controller.ts',
          httpMethod: 'GET',
          nodeType: 'method_definition',
          parentSymbolName: 'UsersController',
          parseStrategy: 'tree_sitter',
          routePath: '/users',
          startLine: 20,
          symbolKind: 'endpoint'
        }),
        type: 'symbol'
      }),
      expect.objectContaining({
        id: 'external:http:GET:/users',
        label: 'GET /users',
        metadata: expect.objectContaining({
          httpMethod: 'GET',
          routePath: '/users'
        }),
        type: 'external_package'
      })
    ]))

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          label: 'GET /users',
          rawType: 'http_endpoint'
        }),
        source: 'symbol:/repo/apps/api/src/users.controller.ts:seg-listUsers',
        target: 'external:http:GET:/users',
        type: 'produces'
      })
    ]))
  })

  it('resolves import edges from ingest.v2 import metadata before falling back to source parsing', async () => {
    const repo = { id: 6, name: 'semantic-imports' }
    const service = createService(repo, [
      astSegment('/repo/apps/api/src/users.controller.ts', 'listUsers', {
        content: 'return this.usersService.list()',
        import_specifiers: ['./users.service'],
        symbol_kind: 'http_endpoint'
      }),
      astSegment('/repo/apps/api/src/users.service.ts', 'UsersService', {
        content: 'export class UsersService {}',
        node_type: 'class_declaration',
        segment_id: 'seg-users-service',
        symbol_kind: 'service'
      })
    ])

    const graph = await service.getRepoInteractiveGraph(6, repo.id, {
      includeSymbols: 'true'
    })

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          label: './users.service',
          rawType: 'import'
        }),
        source: 'file:/repo/apps/api/src/users.controller.ts',
        target: 'file:/repo/apps/api/src/users.service.ts',
        type: 'imports'
      })
    ]))
  })
})
