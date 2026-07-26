import { ServiceUnavailableException } from '@nestjs/common'
import type { RepoGraphEdge } from '@workspace/codepath-common/graph'
import { RepoGraphEdgeType } from '@workspace/codepath-common/graph'

import { OrchestratorClientError } from '../orchestrator-client/services/orchestrator-client.service'
import { DependenciesService } from './services/dependencies.service'

type RepoFixture = {
  id: number
  name: string
}

type SegmentFixture = {
  ast_path?: string[]
  call_targets?: string[]
  category?: string
  content?: string
  end_line?: number
  extends_targets?: string[]
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

function createFailingQdrantServiceMock(error: Error) {
  return {
    scroll: jest.fn().mockRejectedValue(error)
  } as never
}

function createOrchestratorClientMock(edges: RepoGraphEdge[] = []) {
  return {
    graphRpc: jest.fn().mockResolvedValue({
      edges,
      nodes: []
    })
  }
}

function createService(
  repo: RepoFixture,
  segments: SegmentFixture[],
  orchestratorClient = createOrchestratorClientMock()
) {
  return new DependenciesService(
    createDbServiceMock(repo),
    createQdrantServiceMock(segments),
    orchestratorClient as never
  )
}

function createServiceWithQdrant(repo: RepoFixture, qdrantService: never) {
  return new DependenciesService(
    createDbServiceMock(repo),
    qdrantService,
    createOrchestratorClientMock() as never
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

  it('merges graph RPC call edges without also running the local regex fallback for AST call data', async () => {
    const repo = { id: 7, name: 'semantic-calls' }
    const aiCallEdge: RepoGraphEdge = {
      id: 'ai-call-run-target',
      metadata: {
        label: 'TargetFromAst',
        rawType: 'symbol_call_ast'
      },
      source: 'symbol:/repo/src/caller.ts:seg-run',
      target: 'symbol:/repo/src/targets.ts:seg-target-from-ast',
      type: RepoGraphEdgeType.CALLS
    }
    const orchestratorClient = createOrchestratorClientMock([aiCallEdge])
    const service = createService(repo, [
      astSegment('/repo/src/caller.ts', 'run', {
        call_targets: ['TargetFromAst'],
        content: 'TargetFromRegex()',
        import_specifiers: ['./targets'],
        segment_id: 'seg-run',
        symbol_kind: 'function'
      }),
      astSegment('/repo/src/targets.ts', 'TargetFromAst', {
        content: 'export function TargetFromAst() {}',
        segment_id: 'seg-target-from-ast',
        symbol_kind: 'function'
      }),
      astSegment('/repo/src/targets.ts', 'TargetFromRegex', {
        content: 'export function TargetFromRegex() {}',
        segment_id: 'seg-target-from-regex',
        symbol_kind: 'function'
      })
    ], orchestratorClient)

    const graph = await service.getRepoInteractiveGraph(7, repo.id, {
      includeSymbols: 'true'
    })

    expect(orchestratorClient.graphRpc).toHaveBeenCalledWith({
      relationTypes: ['calls', 'extends'],
      repoId: repo.id
    })
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: {
          label: 'TargetFromAst',
          rawType: 'symbol_call_ast'
        },
        source: 'symbol:/repo/src/caller.ts:seg-run',
        target: 'symbol:/repo/src/targets.ts:seg-target-from-ast',
        type: 'calls'
      })
    ]))
    expect(graph.edges.some(edge => (
      edge.source === 'file:/repo/src/caller.ts'
      && edge.type === RepoGraphEdgeType.CALLS
    ))).toBe(false)
    expect(graph.edges.some(edge => edge.metadata?.label === 'TargetFromRegex' && edge.type === RepoGraphEdgeType.CALLS)).toBe(false)
  })

  it('filters merged graph RPC extends edges through the existing relation type pipeline', async () => {
    const repo = { id: 8, name: 'semantic-extends' }
    const orchestratorClient = createOrchestratorClientMock([{
      id: 'ai-extends-derived-base',
      metadata: {
        label: 'BaseService',
        rawType: 'symbol_extends'
      },
      source: 'symbol:/repo/src/derived.ts:seg-derived-service',
      target: 'symbol:/repo/src/base.ts:seg-base-service',
      type: RepoGraphEdgeType.EXTENDS
    }])
    const service = createService(repo, [
      astSegment('/repo/src/derived.ts', 'DerivedService', {
        content: 'export class DerivedService extends BaseService {}',
        extends_targets: ['BaseService'],
        import_specifiers: ['./base'],
        node_type: 'class_declaration',
        segment_id: 'seg-derived-service',
        symbol_kind: 'class'
      }),
      astSegment('/repo/src/base.ts', 'BaseService', {
        content: 'export class BaseService {}',
        node_type: 'class_declaration',
        segment_id: 'seg-base-service',
        symbol_kind: 'class'
      })
    ], orchestratorClient)

    const graph = await service.getRepoInteractiveGraph(8, repo.id, {
      includeSymbols: 'true',
      relationTypes: 'extends'
    })

    expect(graph.edges).toEqual([
      expect.objectContaining({
        metadata: {
          label: 'BaseService',
          rawType: 'symbol_extends'
        },
        source: 'symbol:/repo/src/derived.ts:seg-derived-service',
        target: 'symbol:/repo/src/base.ts:seg-base-service',
        type: 'extends'
      })
    ])
    expect(graph.metadata.availableEdgeTypes).toEqual(['extends'])
    expect(graph.filters.relationTypes).toEqual(['extends'])
  })

  it('keeps the existing file-to-symbol regex call fallback when AST call targets are empty', async () => {
    const repo = { id: 9, name: 'legacy-call-fallback' }
    const service = createService(repo, [
      astSegment('/repo/src/caller.ts', 'runLegacy', {
        call_targets: [],
        content: 'LegacyTarget()',
        import_specifiers: ['./target'],
        segment_id: 'seg-run-legacy',
        symbol_kind: 'function'
      }),
      astSegment('/repo/src/target.ts', 'LegacyTarget', {
        content: 'export function LegacyTarget() {}',
        segment_id: 'seg-legacy-target',
        symbol_kind: 'function'
      })
    ])

    const graph = await service.getRepoInteractiveGraph(9, repo.id, {
      includeSymbols: 'true'
    })

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: {
          label: 'LegacyTarget',
          rawType: 'symbol_call'
        },
        source: 'file:/repo/src/caller.ts',
        target: 'symbol:/repo/src/target.ts:seg-legacy-target',
        type: 'calls'
      })
    ]))
  })

  it('deduplicates graph RPC edges against local fallback edges by source, type, and target', async () => {
    const repo = { id: 10, name: 'deduplicated-calls' }
    const duplicateAiEdge: RepoGraphEdge = {
      id: 'ai-duplicate-call',
      metadata: {
        label: 'LegacyTarget',
        rawType: 'symbol_call_ast'
      },
      source: 'file:/repo/src/caller.ts',
      target: 'symbol:/repo/src/target.ts:seg-legacy-target',
      type: RepoGraphEdgeType.CALLS
    }
    const service = createService(repo, [
      astSegment('/repo/src/caller.ts', 'runLegacy', {
        call_targets: [],
        content: 'LegacyTarget()',
        import_specifiers: ['./target'],
        segment_id: 'seg-run-legacy',
        symbol_kind: 'function'
      }),
      astSegment('/repo/src/target.ts', 'LegacyTarget', {
        content: 'export function LegacyTarget() {}',
        segment_id: 'seg-legacy-target',
        symbol_kind: 'function'
      })
    ], createOrchestratorClientMock([duplicateAiEdge]))

    const graph = await service.getRepoInteractiveGraph(10, repo.id, {
      includeSymbols: 'true'
    })
    const matchingEdges = graph.edges.filter(edge => (
      edge.source === duplicateAiEdge.source
      && edge.type === duplicateAiEdge.type
      && edge.target === duplicateAiEdge.target
    ))

    expect(matchingEdges).toHaveLength(1)
    expect(matchingEdges[0]).toMatchObject({
      id: 'file:/repo/src/caller.ts->symbol:/repo/src/target.ts:seg-legacy-target:calls',
      metadata: {
        label: 'LegacyTarget',
        rawType: 'symbol_call'
      }
    })
  })

  it('applies focus and depth filtering after graph RPC edges are merged', async () => {
    const repo = { id: 11, name: 'scoped-ai-calls' }
    const symbolIds = {
      first: 'symbol:/repo/src/symbols.ts:seg-first',
      focus: 'symbol:/repo/src/symbols.ts:seg-focus',
      second: 'symbol:/repo/src/symbols.ts:seg-second',
      third: 'symbol:/repo/src/symbols.ts:seg-third'
    }
    const orchestratorClient = createOrchestratorClientMock([
      {
        id: 'focus-first',
        source: symbolIds.focus,
        target: symbolIds.first,
        type: RepoGraphEdgeType.CALLS
      },
      {
        id: 'first-second',
        source: symbolIds.first,
        target: symbolIds.second,
        type: RepoGraphEdgeType.CALLS
      },
      {
        id: 'second-third',
        source: symbolIds.second,
        target: symbolIds.third,
        type: RepoGraphEdgeType.CALLS
      }
    ])
    const service = createService(repo, [
      astSegment('/repo/src/symbols.ts', 'focus', { segment_id: 'seg-focus', symbol_kind: 'function' }),
      astSegment('/repo/src/symbols.ts', 'first', { segment_id: 'seg-first', symbol_kind: 'function' }),
      astSegment('/repo/src/symbols.ts', 'second', { segment_id: 'seg-second', symbol_kind: 'function' }),
      astSegment('/repo/src/symbols.ts', 'third', { segment_id: 'seg-third', symbol_kind: 'function' })
    ], orchestratorClient)

    const graph = await service.getRepoInteractiveGraph(11, repo.id, {
      depth: '1',
      focusNodeId: symbolIds.focus,
      includeSymbols: 'true',
      relationTypes: 'calls'
    })

    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: symbolIds.focus,
        target: symbolIds.first,
        type: RepoGraphEdgeType.CALLS
      })
    ])
    expect(graph.nodes.map(node => node.id).sort()).toEqual([
      `repo:${repo.id}`,
      symbolIds.first,
      symbolIds.focus
    ].sort())
    expect(graph.filters).toMatchObject({
      depth: 1,
      focusNodeId: symbolIds.focus,
      relationTypes: [RepoGraphEdgeType.CALLS]
    })
  })

  it('applies graph scale limits after graph RPC edges are merged', async () => {
    const repo = { id: 12, name: 'scaled-ai-calls' }
    const symbolCount = 88
    const symbolSegments = Array.from({ length: symbolCount }, (_, index) => (
      astSegment('/repo/src/symbols.ts', `symbol${index}`, {
        content: `export function symbol${index}() {}`,
        segment_id: `seg-symbol-${index}`,
        symbol_kind: 'function'
      })
    ))
    const symbolNodeIds = symbolSegments.map(segment => `symbol:${segment.file_path}:${segment.segment_id}`)
    const aiEdges: RepoGraphEdge[] = []

    for (const source of symbolNodeIds) {
      for (const target of symbolNodeIds) {
        if (source === target) continue

        aiEdges.push({
          id: `${source}->${target}:calls`,
          source,
          target,
          type: RepoGraphEdgeType.CALLS
        })

        if (aiEdges.length === 3_801) break
      }

      if (aiEdges.length === 3_801) break
    }

    const service = createService(repo, symbolSegments, createOrchestratorClientMock(aiEdges))
    const graph = await service.getRepoInteractiveGraph(12, repo.id, {
      includeSymbols: 'true',
      relationTypes: 'calls'
    })

    expect(graph.edges).toHaveLength(3_800)
    expect(graph.metadata).toMatchObject({
      edgeCount: 3_800,
      truncated: true,
      truncationReason: 'edge_cap'
    })
    expect(graph.metadata.availableEdgeTypes).toEqual([RepoGraphEdgeType.CALLS])
  })

  it('surfaces graph RPC failures as service unavailable', async () => {
    const repo = { id: 13, name: 'graph-rpc-down' }
    const orchestratorClient = {
      graphRpc: jest.fn().mockRejectedValue(new OrchestratorClientError('Orchestrator request timed out'))
    }
    const service = createService(repo, [
      astSegment('/repo/src/app.ts', 'run', {
        segment_id: 'seg-run',
        symbol_kind: 'function'
      })
    ], orchestratorClient)

    const graphRequest = service.getRepoInteractiveGraph(13, repo.id, {
      includeSymbols: 'true'
    })

    await expect(graphRequest).rejects.toMatchObject({
      message: 'Repository dependency graph is unavailable because the graph RPC failed'
    })
    await expect(graphRequest).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('does not apply the removed local per-file AST call cap to graph RPC edges', async () => {
    const repo = { id: 10, name: 'semantic-call-cap' }
    const targetNames = Array.from({ length: 125 }, (_, index) => `Target${index}`)
    const targetSegments = targetNames.map(targetName => astSegment('/repo/src/targets.ts', targetName, {
      content: `export function ${targetName}() {}`,
      segment_id: `seg-${targetName}`,
      symbol_kind: 'function'
    }))
    const aiCallEdges: RepoGraphEdge[] = targetNames.map(targetName => ({
      id: `ai-run-all-${targetName}`,
      metadata: {
        label: targetName,
        rawType: 'symbol_call_ast'
      },
      source: 'symbol:/repo/src/caller.ts:seg-run-all',
      target: `symbol:/repo/src/targets.ts:seg-${targetName}`,
      type: RepoGraphEdgeType.CALLS
    }))
    const service = createService(repo, [
      astSegment('/repo/src/caller.ts', 'runAll', {
        call_targets: targetNames,
        content: 'return true',
        import_specifiers: ['./targets'],
        segment_id: 'seg-run-all',
        symbol_kind: 'function'
      }),
      ...targetSegments
    ], createOrchestratorClientMock(aiCallEdges))

    const graph = await service.getRepoInteractiveGraph(10, repo.id, {
      includeSymbols: 'true'
    })
    const astCallEdges = graph.edges.filter(edge => (
      edge.source === 'symbol:/repo/src/caller.ts:seg-run-all'
      && edge.type === RepoGraphEdgeType.CALLS
      && edge.metadata?.rawType === 'symbol_call_ast'
    ))

    expect(astCallEdges).toHaveLength(125)
  })

  it('surfaces Qdrant failures instead of returning an empty graph', async () => {
    const repo = { id: 14, name: 'qdrant-down' }
    const service = createServiceWithQdrant(
      repo,
      createFailingQdrantServiceMock(new Error('connection refused'))
    )

    await expect(service.getRepoInteractiveGraph(7, repo.id, {
      includeSymbols: 'false'
    })).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
