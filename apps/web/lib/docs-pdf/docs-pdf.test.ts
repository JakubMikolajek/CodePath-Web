// @vitest-environment node
import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { RepoDocsSectionKey, RepoDocsStatus } from '@workspace/codepath-common/repository'
import { describe, expect, it } from 'vitest'

import { createDocsPdfDefinition } from './document'
import { highlightCode } from './highlight'
import { markdownToPdf } from './markdown-to-pdf'
import { sanitizePdfText } from './sanitize'

describe('docs PDF content', () => {
  it('maps headings, inline formatting, links and blockquotes', () => {
    const content = markdownToPdf('# Title\n\n> quoted\n\nText with `code` and [link](https://example.com).')

    expect(content[0]).toMatchObject({ style: 'h1' })
    expect(content[1]).toMatchObject({ border: [true, false, false, false] })
    expect(JSON.stringify(content[2])).toContain('Code')
    expect(JSON.stringify(content[2])).toContain('https://example.com')
  })

  it('maps nested task lists and aligned GFM tables without fixed overflow widths', () => {
    const content = markdownToPdf('- [x] done\n  - nested\n\n| A | B |\n| :- | -: |\n| one | two |')

    expect(JSON.stringify(content)).toContain('[x]')
    expect(JSON.stringify(content)).toContain('"ul"')
    expect(content.find(item => 'table' in item)).toMatchObject({ table: { widths: ['*', '*'] } })
  })

  it('preserves syntax whitespace and falls back to plain code for unknown languages', () => {
    const known = highlightCode('typescript', 'const value = 1\n')
    const unknown = highlightCode('not-a-language', ' a\n  b')

    expect(known.map(run => run.text).join('')).toBe('const value = 1\n')
    expect(known.some(run => run.color)).toBe(true)
    expect(unknown).toEqual([{ font: 'Code', text: ' a\n  b' }])
  })

  it('substitutes unsupported symbols while preserving Polish glyphs', () => {
    expect(sanitizePdfText('Zażółć → ✓ 😀')).toBe('Zażółć -> v [symbol]')
  })

  it('verifies the body font cmap covers Polish text and sanitizes known missing symbols', () => {
    // fontkit is a transitive pdfkit dependency; resolve it from pdfkit so this remains a test-only Node concern.
    const packageRequire = createRequire(import.meta.url)
    const pdfkitEntry = createRequire(packageRequire.resolve('pdfmake')).resolve('pdfkit')
    const fontkitRequire = createRequire(pdfkitEntry)
    const fontkit = fontkitRequire('fontkit') as { openSync: (path: string) => { hasGlyphForCodePoint: (codePoint: number) => boolean } }
    const font = fontkit.openSync(join(process.cwd(), 'public/fonts/Roboto-Regular.ttf'))

    for (const character of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ“”‘’') expect(font.hasGlyphForCodePoint(character.codePointAt(0)!)).toBe(true)
    expect(font.hasGlyphForCodePoint('→'.codePointAt(0)!)).toBe(false)
    expect(sanitizePdfText('→')).toBe('->')
  })
})

describe('docs PDF markdown fidelity', () => {
  it('keeps inline code inside one text block per list item instead of stacking runs', () => {
    const [list] = markdownToPdf('- **Label:** call `run()` now\n- plain')

    const items = list.ul as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    expect(Array.isArray(items[0].text)).toBe(true)
    expect(JSON.stringify(items[0].text)).toContain('run()')
    expect(JSON.stringify(items[0].text)).toContain('Code')
  })

  it('collapses soft line breaks to spaces but keeps hard breaks', () => {
    const [soft, hard] = [markdownToPdf('one\ntwo')[0], markdownToPdf('one  \ntwo')[0]]

    expect(JSON.stringify(soft.text)).toContain('one two')
    expect(JSON.stringify(hard.text)).toContain('\\n')
  })

  it('mutes evidence tags and drops empty ones', () => {
    const [paragraph] = markdownToPdf('Uses Qdrant [source file=shared/qdrant.py] and more [source file=].')
    const runs = paragraph.text as Array<Record<string, unknown>>

    expect(runs.find(run => String(run.text).includes('source file=shared/qdrant.py'))).toMatchObject({ color: '#8c959f', fontSize: 8 })
    expect(JSON.stringify(runs)).not.toContain('source file=]')
  })

  it('drops a leading heading that repeats the section title only', () => {
    const repeated = markdownToPdf('# Overview\n\nBody', { dropLeadingHeadingLike: 'Overview' })
    const different = markdownToPdf('# Other\n\nBody', { dropLeadingHeadingLike: 'Overview' })

    expect(repeated).toHaveLength(1)
    expect(different).toHaveLength(2)
  })
})

describe('docs PDF layout', () => {
  it('starts the table of contents on its own page instead of leaving its heading on the cover', () => {
    const definition = createDocsPdfDefinition({ generatedAt: null, modules: [] }, { repoId: 1, repositoryName: 'Repo' })
    const content = definition.content as Array<Record<string, unknown>>
    const tocHeading = content.find(item => item.text === 'Table of contents')

    expect(tocHeading).toMatchObject({ pageBreak: 'before' })
    expect(tocHeading).not.toHaveProperty('pageBreak', 'after')
  })
})

describe('docs PDF node smoke test', () => {
  it('builds a multi-page PDF with embedded Polish fonts', async () => {
    const require = createRequire(import.meta.url)
    const pdfMake = require('pdfmake') as {
      createPdf: (definition: Record<string, unknown>) => { getBuffer: () => Promise<Buffer> }
      setFonts: (fonts: Record<string, Record<string, string>>) => void
    }
    const fontsDirectory = join(process.cwd(), 'public/fonts')

    pdfMake.setFonts({
      Code: {
        bold: join(fontsDirectory, 'DejaVuSansMono-Bold.ttf'),
        bolditalics: join(fontsDirectory, 'DejaVuSansMono-BoldOblique.ttf'),
        italics: join(fontsDirectory, 'DejaVuSansMono-Oblique.ttf'),
        normal: join(fontsDirectory, 'DejaVuSansMono.ttf')
      },
      Roboto: {
        bold: join(fontsDirectory, 'Roboto-Medium.ttf'),
        bolditalics: join(fontsDirectory, 'Roboto-MediumItalic.ttf'),
        italics: join(fontsDirectory, 'Roboto-Italic.ttf'),
        normal: join(fontsDirectory, 'Roboto-Regular.ttf')
      }
    })
    const definition = createDocsPdfDefinition({
      generatedAt: '2026-09-19T10:00:00.000Z',
      modules: [{
        key: 'core',
        sections: [{ generatedAt: '2026-09-19T10:00:00.000Z', key: RepoDocsSectionKey.OVERVIEW, markdown: '| Kolumna | Wartość |\n| - | - |\n| Łódź | ✓ |\n\n```typescript\nconst wartość = "ąęł";\n```', status: RepoDocsStatus.READY, title: 'Overview' }],
        summary: 'Zażółć gęślą jaźń',
        title: 'Core',
        unavailableSections: []
      }]
    }, { repoId: 1, repositoryName: 'Łódź repository' })
    const buffer = await pdfMake.createPdf(definition).getBuffer()
    const fixturePath = join(tmpdir(), 'codepath-docs-pdf-smoke.pdf')

    await writeFile(fixturePath, buffer)
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    expect((buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    console.info(`PDF smoke fixture: ${fixturePath}`)
  })
})
