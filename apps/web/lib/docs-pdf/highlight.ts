import dockerfile from 'highlight.js/lib/languages/dockerfile'
import { common, createLowlight } from 'lowlight'

import { sanitizePdfText } from './sanitize'

type HastNode = { children?: HastNode[]; properties?: { className?: string[] }; type: string; value?: string }

export interface PdfTextRun {
  bold?: boolean
  color?: string
  font?: string
  fontSize?: number
  italics?: boolean
  text: string
}

const palette: Record<string, Partial<PdfTextRun>> = {
  'attr': { color: '#0550ae' },
  'built_in': { color: '#8250df' },
  'comment': { color: '#6e7781', italics: true },
  'keyword': { bold: true, color: '#cf222e' },
  'literal': { color: '#0550ae' },
  'meta': { color: '#8250df' },
  'number': { color: '#0550ae' },
  'operator': { color: '#cf222e' },
  'params': { color: '#24292f' },
  'punctuation': { color: '#24292f' },
  'string': { color: '#0a6b2b' },
  'subst': { color: '#24292f' },
  'tag': { color: '#116329' },
  'title': { color: '#8250df' },
  'type': { color: '#0550ae' },
  'variable': { color: '#953800' }
}

const lowlight = createLowlight(common)

lowlight.register('dockerfile', dockerfile)

function classesToStyle(classes: string[] | undefined): Partial<PdfTextRun> {
  const token = classes?.map(item => item.replace('hljs-', '')).find(item => palette[item])

  return token ? palette[token] : {}
}

function mapNode(node: HastNode, inherited: Partial<PdfTextRun> = {}): PdfTextRun[] {
  if (node.type === 'text') return [{ ...inherited, font: 'Code', text: sanitizePdfText(node.value ?? '') }]

  const style = { ...inherited, ...classesToStyle(node.properties?.className) }

  return node.children?.flatMap(child => mapNode(child, style)) ?? []
}

export function highlightCode(language: null | string | undefined, value: string): PdfTextRun[] {
  if (!language || !lowlight.registered(language)) return [{ font: 'Code', text: sanitizePdfText(value) }]

  try {
    return lowlight.highlight(language, value).children.flatMap(node => mapNode(node as HastNode))
  } catch {
    return [{ font: 'Code', text: sanitizePdfText(value) }]
  }
}
