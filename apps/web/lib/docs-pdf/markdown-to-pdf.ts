import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { highlightCode, type PdfTextRun } from './highlight'
import { sanitizePdfText } from './sanitize'

type MdNode = { align?: ('center' | 'left' | 'right' | null)[]; checked?: boolean | null; children?: MdNode[]; depth?: number; lang?: null | string; ordered?: boolean; start?: null | number; type: string; url?: string; value?: string }
export type PdfContent = Record<string, unknown>

const parser = unified().use(remarkParse).use(remarkGfm)

const EVIDENCE_TAG = /\s?\[source file=([^\]]*)\]/gi

/** Soft line breaks collapse to spaces (as in HTML); evidence tags become small muted runs, empty tags are dropped. */
function textRuns(value: string): PdfTextRun[] {
  const text = value.replace(/\s*\n\s*/g, ' ')
  const runs: PdfTextRun[] = []
  let last = 0

  for (const match of text.matchAll(EVIDENCE_TAG)) {
    if (match.index > last) runs.push({ text: sanitizePdfText(text.slice(last, match.index)) })
    if (match[1].trim()) runs.push({ color: '#8c959f', fontSize: 8, text: ` [source file=${sanitizePdfText(match[1].trim())}]` })
    last = match.index + match[0].length
  }

  if (last < text.length) runs.push({ text: sanitizePdfText(text.slice(last)) })

  return runs
}

function inline(nodes: MdNode[] = []): Array<PdfContent | PdfTextRun> {
  return nodes.flatMap(node => {
    const children = inline(node.children)
    switch (node.type) {
      case 'text': return textRuns(node.value ?? '')
      case 'break': return [{ text: '\n' }]
      case 'emphasis': return children.map(child => typeof child === 'object' && 'text' in child ? { ...child, italics: true } : child)
      case 'strong': return children.map(child => typeof child === 'object' && 'text' in child ? { ...child, bold: true } : child)
      case 'delete': return children.map(child => typeof child === 'object' && 'text' in child ? { ...child, decoration: 'lineThrough' } : child)
      case 'inlineCode': return [{ background: '#f6f8fa', font: 'Code', text: sanitizePdfText(node.value ?? '') }]
      case 'link': return children.map(child => typeof child === 'object' && 'text' in child ? { ...child, color: '#0969da', decoration: 'underline', link: node.url } : child)
      case 'image': return [{ color: '#57606a', italics: true, text: `[image: ${sanitizePdfText(node.children?.[0]?.value ?? '')}]` }]
      default: return children
    }
  })
}

function table(node: MdNode): PdfContent {
  const rows = node.children ?? []
  const columns = rows[0]?.children?.length ?? 1
  return {
    layout: 'lightHorizontalLines',
    margin: [0, 6, 0, 10],
    table: {
      headerRows: 1,
      widths: Array.from({ length: columns }, () => '*'),
      body: rows.map((row, rowIndex) => (row.children ?? []).map((cell, index) => ({
        alignment: node.align?.[index] ?? 'left',
        bold: rowIndex === 0,
        fillColor: rowIndex === 0 ? '#f6f8fa' : undefined,
        margin: [4, 3],
        text: inline(cell.children)
      })))
    }
  }
}

function list(node: MdNode): PdfContent {
  const entries = (node.children ?? []).map(item => {
    const prefix = item.checked === true ? '[x] ' : item.checked === false ? '[ ] ' : ''
    const parts = (item.children ?? []).flatMap((child, index): PdfContent[] => {
      if (child.type !== 'paragraph') return block(child)

      // An array of runs directly inside a pdfmake list would be laid out as separate stacked lines.
      const runs = inline(child.children)
      return [{ text: index === 0 && prefix ? [{ text: prefix }, ...runs] : runs }]
    })

    return parts.length === 1 ? parts[0] : { stack: parts }
  })

  return node.ordered ? { margin: [0, 3, 0, 7], ol: entries, start: node.start ?? 1 } : { margin: [0, 3, 0, 7], ul: entries }
}

function block(node: MdNode): PdfContent[] {
  switch (node.type) {
    case 'heading': return [{ margin: [0, 12, 0, 6], style: `h${Math.min(6, node.depth ?? 6)}`, text: inline(node.children) }]
    case 'paragraph': return [{ margin: [0, 0, 0, 7], text: inline(node.children) }]
    case 'code': return [{ border: [true, true, true, true], color: '#24292f', fillColor: '#f6f8fa', margin: [0, 5, 0, 9], noWrap: false, style: 'code', text: highlightCode(node.lang, node.value ?? '') }]
    case 'blockquote': return [{ border: [true, false, false, false], borderColor: '#d0d7de', color: '#57606a', margin: [8, 5, 0, 9], stack: (node.children ?? []).flatMap(block) }]
    case 'list': return [list(node)]
    case 'table': return [table(node)]
    case 'thematicBreak': return [{ canvas: [{ color: '#d0d7de', lineWidth: 1, type: 'line', x1: 0, x2: 500, y1: 0, y2: 0 }], margin: [0, 7, 0, 10] }]
    case 'html': return [{ color: '#57606a', text: sanitizePdfText(node.value ?? '') }]
    default: return (node.children ?? []).flatMap(block)
  }
}

function plainText(node: MdNode): string {
  return node.value ?? (node.children ?? []).map(plainText).join('')
}

const normalizeTitle = (value: string) => value.trim().replace(/[:.]\s*$/, '').toLowerCase()

interface MarkdownToPdfOptions {
  /** Drops a leading heading that only repeats the surrounding section title. */
  dropLeadingHeadingLike?: string
}

export function markdownToPdf(markdown: string, { dropLeadingHeadingLike }: MarkdownToPdfOptions = {}): PdfContent[] {
  const nodes = (parser.parse(markdown) as unknown as MdNode).children ?? []
  const [first, ...rest] = nodes
  const isDuplicateHeading = dropLeadingHeadingLike && first?.type === 'heading' && normalizeTitle(plainText(first)) === normalizeTitle(dropLeadingHeadingLike)

  return (isDuplicateHeading ? rest : nodes).flatMap(block)
}
