import { DepEdge } from './parser'

export function buildMermaidGraph(deps: DepEdge[]): string {
  const lines = ['flowchart TD']
  for (const { from, to, type, importedFrom } of deps) {
    const safeFrom = sanitize(from)
    const safeTo = sanitize(to)
    const safeType = sanitize(type)

    const labelParts = [safeType]
    if (importedFrom) {
      labelParts.push(`from ${importedFrom}`)
    }

    const label = labelParts.join(' ')

    lines.push(
      `  ${safeFrom}["${from}"] -->|${label}| ${safeTo}["${to}"]`,
    )
  }
  return lines.join('\n')
}

function sanitize(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
}
