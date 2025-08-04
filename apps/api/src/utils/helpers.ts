import { toLower, replace } from 'lodash'

import { SelectEmbedding, SelectFile } from '../modules/db/schema'

import { Segment } from './parser'

export function sanitizeString(value: string): string {
  return replace(toLower(value), /[^a-z0-9]/g, '_')
}

export function cutContext(chunks: string[], maxChars = 64000) {
  const out: string[] = []
  let used = 0

  for (const txt of chunks) {
    if (used + txt.length > maxChars) {
      break
    }

    out.push(txt)
    used += txt.length
  }
  return out
}

interface SegmentItem {
  embeddings: SelectEmbedding
  files: SelectFile
}

export function summarizeSegments(
  segments: SegmentItem[],
  maxLength = 100000
): string[] {
  const summaries: string[] = []
  let current = ''

  for (const seg of segments) {
    const lines: string[] = []
    lines.push('Source:\n```ts\n' + seg.embeddings.content + '\n```')

    if (seg.embeddings.symbolKind) lines.push(`Kind: ${seg.embeddings.symbolKind}`)
    if (seg.embeddings.symbolName) lines.push(`Name: ${seg.embeddings.symbolName}`)
    if (seg.embeddings.comment) lines.push(`Comment: ${seg.embeddings.comment}`)
    if (seg.embeddings.jsDoc) lines.push(`JSDoc: ${seg.embeddings.jsDoc}`)
    if (Array.isArray(seg.embeddings.params) && seg.embeddings.params.length)
      lines.push(`Params: ${seg.embeddings.params.join(', ')}`)
    if (seg.embeddings.returnType) lines.push(`Returns: ${seg.embeddings.returnType}`)
    if (Array.isArray(seg.embeddings.decorators) && seg.embeddings.decorators.length)
      lines.push(`Decorators: ${seg.embeddings.decorators.join(', ')}`)
    if (seg.embeddings.startLine != null && seg.embeddings.endLine != null)
      lines.push(`Lines: ${seg.embeddings.startLine}-${seg.embeddings.endLine}`)

    if (lines.length === 0) continue

    lines.push('--------------------')
    const summary = lines.join('\n') + '\n'

    if (current.length + summary.length > maxLength) {
      summaries.push(current)
      current = ''
    }

    current += summary
  }

  if (current) summaries.push(current)

  return summaries
}
