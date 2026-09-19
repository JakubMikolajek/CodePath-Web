import type { ExportDocsDocument } from '@/lib/docs-export'

import { createDocsPdfDefinition } from './document'
import { loadPdfFonts, pdfFonts } from './fonts'

export async function buildDocsPdf(document: ExportDocsDocument, options: { repoId: number; repositoryName: string }): Promise<Blob> {
  const [{ default: pdfMake }, virtualFiles] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    loadPdfFonts()
  ])
  const pdf = pdfMake as unknown as {
    addVirtualFileSystem: (files: Record<string, string>) => void
    createPdf: (definition: Record<string, unknown>) => { getBlob: () => Promise<Blob> }
    setFonts: (fonts: typeof pdfFonts) => void
  }

  pdf.addVirtualFileSystem(virtualFiles)
  pdf.setFonts(pdfFonts)

  return pdf.createPdf(createDocsPdfDefinition(document, options)).getBlob()
}

export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.download = filename
  link.href = url
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
