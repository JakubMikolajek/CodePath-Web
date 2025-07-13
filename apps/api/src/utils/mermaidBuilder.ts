import { GenericNullable } from '@workspace/codepath-common/globals'
import { join, isEmpty } from 'lodash'

import { sanitizeString } from './helpers'
import { DepEdge } from './parser'

export function buildMermaidGraph(deps: DepEdge[]): GenericNullable<string> {
  if (isEmpty(deps)) {
    return null
  }

  const lines = ['flowchart TD']

  for (const { from, to, type, importedFrom } of deps) {
    const safeFrom = sanitizeString(from)
    const safeTo = sanitizeString(to)
    const safeType = sanitizeString(type)

    const labelParts = [safeType]

    if (importedFrom) {
      labelParts.push(`from ${importedFrom}`)
    }

    const label = join(labelParts, ' ')

    lines.push(
      `  ${safeFrom}["${from}"] -->|${label}| ${safeTo}["${to}"]`,
    )
  }
  return join(lines, '\n')
}
