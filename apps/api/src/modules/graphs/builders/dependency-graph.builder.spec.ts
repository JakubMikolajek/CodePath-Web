import { RepoGraphEdgeType } from '@workspace/codepath-common/graph'

import {
  DependencyGraphBuilder,
  type IngestSegmentPayload
} from './dependency-graph.builder'

function astSegment(
  filePath: string,
  symbolName: string,
  extra: Partial<IngestSegmentPayload> = {}
): IngestSegmentPayload {
  return {
    ast_path: extra.ast_path ?? ['program', 'class_declaration', 'method_definition'],
    category: 'code',
    content: extra.content ?? 'return true',
    file_ext: extra.file_ext ?? '.ts',
    file_path: filePath,
    language: extra.language ?? 'typescript',
    message_type: 'ingest.batch.ready',
    node_type: extra.node_type ?? 'method_definition',
    parse_strategy: 'tree_sitter',
    segment_id: extra.segment_id ?? `seg-${symbolName}`,
    symbol_kind: extra.symbol_kind ?? 'function',
    symbol_name: symbolName,
    ...extra
  }
}

describe('DependencyGraphBuilder symbol relation ownership', () => {
  const builder = new DependencyGraphBuilder()
  const repo = { id: 1, name: 'graph-rpc-cutover' }

  it('does not emit AST-sourced CALLS or any EXTENDS edges locally', () => {
    const graph = builder.build(repo, [
      astSegment('/repo/src/source.ts', 'run', {
        call_targets: ['TargetFromAst'],
        content: 'TargetFromRegex()',
        import_specifiers: ['./targets'],
        segment_id: 'seg-run'
      }),
      astSegment('/repo/src/source.ts', 'DerivedService', {
        content: 'export class DerivedService extends BaseService {}',
        extends_targets: ['BaseService'],
        node_type: 'class_declaration',
        segment_id: 'seg-derived',
        symbol_kind: 'class'
      }),
      astSegment('/repo/src/targets.ts', 'TargetFromAst', {
        content: 'export function TargetFromAst() {}',
        segment_id: 'seg-target-from-ast'
      }),
      astSegment('/repo/src/targets.ts', 'TargetFromRegex', {
        content: 'export function TargetFromRegex() {}',
        segment_id: 'seg-target-from-regex'
      }),
      astSegment('/repo/src/targets.ts', 'BaseService', {
        content: 'export class BaseService {}',
        node_type: 'class_declaration',
        segment_id: 'seg-base',
        symbol_kind: 'class'
      })
    ], { includeSymbols: true })

    expect(graph.edges.filter(edge => (
      edge.type === RepoGraphEdgeType.CALLS
      || edge.type === RepoGraphEdgeType.EXTENDS
    ))).toEqual([])
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'file:/repo/src/source.ts',
        target: 'file:/repo/src/targets.ts',
        type: RepoGraphEdgeType.IMPORTS
      }),
      expect.objectContaining({
        source: 'file:/repo/src/source.ts',
        target: 'symbol:/repo/src/source.ts:seg-run',
        type: RepoGraphEdgeType.OWNS
      })
    ]))
  })

  it('keeps the file-to-symbol regex CALLS fallback for files without AST call data', () => {
    const graph = builder.build(repo, [
      {
        content: 'LegacyTarget()',
        file_ext: '.ts',
        file_path: '/repo/src/caller.ts',
        import_specifiers: ['./target'],
        language: 'typescript',
        message_type: 'ingest.batch.ready',
        segment_id: 'seg-caller',
        symbol_kind: 'function',
        symbol_name: 'runLegacy'
      },
      {
        content: 'export function LegacyTarget() {}',
        file_ext: '.ts',
        file_path: '/repo/src/target.ts',
        language: 'typescript',
        message_type: 'ingest.batch.ready',
        segment_id: 'seg-target',
        symbol_kind: 'function',
        symbol_name: 'LegacyTarget'
      }
    ], { includeSymbols: true })

    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: {
          label: 'LegacyTarget',
          rawType: 'symbol_call'
        },
        source: 'file:/repo/src/caller.ts',
        target: 'symbol:/repo/src/target.ts:seg-target',
        type: RepoGraphEdgeType.CALLS
      })
    ]))
  })
})
