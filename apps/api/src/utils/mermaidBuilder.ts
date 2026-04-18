import type { Nullable } from '@workspace/codepath-common/globals'
import { isEmpty, join } from 'lodash'

import { sanitizeString } from './helpers'
import type { DepEdge } from './parser-types'

export function buildMermaidGraph(deps: DepEdge[]): Nullable<string> {
  if (isEmpty(deps)) {
    return null
  }

  const lines = [
    'flowchart TD',
    'classDef file fill:#e1f5fe,stroke:#01579b,stroke-width:2px;',
    'classDef logic fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;',
    'classDef lib fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;' // For external/library imports
  ]

  const imports = new Set<string>()
  const logic = new Set<string>()
  const relationships: string[] = []

  for (const { from, importedFrom, to, type } of deps) {
    const safeFrom = sanitizeString(from)
    const safeTo = sanitizeString(to)
    const safeType = sanitizeString(type)

    const labelParts = [safeType]
    if (importedFrom) labelParts.push(`from ${sanitizeString(importedFrom)}`)
    const label = join(labelParts, ' ')

    if (type === 'import') {
      imports.add(`${safeTo}["${to}"]:::lib`)
      logic.add(`${safeFrom}["${from}"]:::file`) // 'from' is the file in an import
    } else {
      logic.add(`${safeFrom}["${from}"]:::logic`)
      logic.add(`${safeTo}["${to}"]:::logic`)
    }

    relationships.push(`  ${safeFrom} -->|${label}| ${safeTo}`)
  }

  // --- Subgraph: External Imports ---
  if (imports.size > 0) {
    lines.push('subgraph Imports')
    imports.forEach(i => lines.push(`  ${i}`))
    lines.push('end')
  }

  // --- Subgraph: Application Logic ---
  lines.push('subgraph Code')
  logic.forEach(l => lines.push(`  ${l}`))
  lines.push('end')

  // --- Relationships ---
  lines.push(...relationships)

  return join(lines, '\n')
}
