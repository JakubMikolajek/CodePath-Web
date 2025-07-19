import { toLower, replace } from 'lodash'

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

export function summarizeSegments(
  segments: any[],
  maxLength = 100000
): string[] {
  const summaries: string[] = []
  let current = ''

  for (const seg of segments) {
    const lines: string[] = []

    if (seg.symbolKind) lines.push(`Kind: ${seg.symbolKind}`)
    if (seg.symbolName) lines.push(`Name: ${seg.symbolName}`)
    if (seg.comment) lines.push(`Comment: ${seg.comment}`)
    if (seg.jsDoc) lines.push(`JSDoc: ${seg.jsDoc}`)
    if (Array.isArray(seg.params) && seg.params.length)
      lines.push(`Params: ${seg.params.join(', ')}`)
    if (seg.returnType) lines.push(`Returns: ${seg.returnType}`)
    if (Array.isArray(seg.decorators) && seg.decorators.length)
      lines.push(`Decorators: ${seg.decorators.join(', ')}`)
    if (seg.startLine != null && seg.endLine != null)
      lines.push(`Lines: ${seg.startLine}-${seg.endLine}`)

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
