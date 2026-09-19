import type { ExportDocsDocument } from '@/lib/docs-export'
import { demoteMarkdownHeadings } from '@/lib/docs-export'

import { markdownToPdf, type PdfContent } from './markdown-to-pdf'
import { sanitizePdfText } from './sanitize'

interface PdfDocumentOptions {
  repoId: number
  repositoryName: string
}

function destination(moduleKey: string, sectionKey?: string): string {
  return sectionKey ? `section-${moduleKey}-${sectionKey}` : `module-${moduleKey}`
}

export function createDocsPdfDefinition(document: ExportDocsDocument, { repoId, repositoryName }: PdfDocumentOptions): Record<string, unknown> {
  const name = sanitizePdfText(repositoryName || `Repository ${repoId}`)
  const generated = document.generatedAt ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(document.generatedAt)) : 'Not available'
  const content: PdfContent[] = [
    {
      margin: [0, 180, 0, 0],
      stack: [
        { color: '#57606a', text: 'GENERATED DOCUMENTATION' },
        { margin: [0, 16, 0, 10], style: 'coverTitle', text: name },
        { color: '#57606a', text: `Generated: ${generated}` },
        { color: '#57606a', margin: [0, 4, 0, 0], text: `${document.modules.length} module${document.modules.length === 1 ? '' : 's'}` }
      ]
    },
    { pageBreak: 'before', style: 'tocHeading', text: 'Table of contents' },
    { toc: { numberStyle: { color: '#57606a' }, title: { text: '' } } }
  ]

  document.modules.forEach((docsModule, moduleIndex) => {
    const chapter = moduleIndex + 1
    content.push({ id: destination(docsModule.key), margin: [0, 0, 0, 12], pageBreak: 'before', style: 'chapter', text: `${chapter} ${sanitizePdfText(docsModule.title)}`, tocItem: true })

    if (docsModule.summary) content.push(...markdownToPdf(demoteMarkdownHeadings(docsModule.summary, 2)))

    docsModule.sections.forEach((section, sectionIndex) => {
      content.push({ id: destination(docsModule.key, section.key), margin: [0, 14, 0, 7], style: 'section', text: `${chapter}.${sectionIndex + 1} ${sanitizePdfText(section.title)}`, tocItem: true })
      content.push(...markdownToPdf(demoteMarkdownHeadings(section.markdown ?? '', 3), { dropLeadingHeadingLike: section.title }))
    })

    if (docsModule.unavailableSections.length) {
      content.push({ margin: [0, 14, 0, 6], style: 'section', text: 'Not generated' })
      content.push({ ul: docsModule.unavailableSections.map(section => `${sanitizePdfText(section.title)} (${section.status.replaceAll('_', ' ')})`) })
    }
  })

  return {
    content,
    defaultStyle: { color: '#24292f', font: 'Roboto', fontSize: 10, lineHeight: 1.25 },
    info: { author: 'CodePath', subject: 'Generated documentation', title: name },
    pageMargins: [48, 48, 48, 45],
    pageOrientation: 'portrait',
    pageSize: 'A4',
    footer: (page: number, pages: number) => ({ alignment: 'center', color: '#57606a', fontSize: 8, margin: [0, 10, 0, 0], text: `Page ${page} of ${pages}` }),
    header: (page: number) => page === 1 ? null : ({ color: '#57606a', fontSize: 8, margin: [40, 16, 40, 0], text: name }),
    styles: {
      chapter: { bold: true, color: '#1f2328', fontSize: 22 },
      code: { font: 'Code', fontSize: 8, lineHeight: 1.15 },
      coverTitle: { bold: true, color: '#1f2328', fontSize: 30 },
      h1: { bold: true, fontSize: 16 },
      h2: { bold: true, fontSize: 14 },
      h3: { bold: true, fontSize: 12 },
      h4: { bold: true, fontSize: 11 },
      h5: { bold: true, fontSize: 10 },
      h6: { bold: true, fontSize: 10 },
      section: { bold: true, color: '#1f2328', fontSize: 15 },
      tocHeading: { bold: true, color: '#1f2328', fontSize: 22 }
    }
  }
}
