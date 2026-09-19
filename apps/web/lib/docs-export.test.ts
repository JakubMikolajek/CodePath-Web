import type { RepoDocsModule, RepoDocsSection } from '@workspace/codepath-common/repository'
import { RepoDocsSectionKey, RepoDocsStatus } from '@workspace/codepath-common/repository'
import { describe, expect, it } from 'vitest'

import { assembleExportDocs, buildDocsMarkdown, demoteMarkdownHeadings, describeUnavailableSection, getDocsFilename, getDocsFilenameWithExtension, hasStoredDocumentation } from './docs-export'

const readySection = (key: RepoDocsSectionKey, title: string, markdown = 'Content'): RepoDocsSection => ({
  generatedAt: '2026-09-19T10:00:00.000Z',
  key,
  markdown,
  status: RepoDocsStatus.READY,
  title
})

const docsModule = (key: string, title: string, sections: RepoDocsSection[]): RepoDocsModule => ({
  generatedAt: '2026-09-19T10:00:00.000Z',
  key,
  path: null,
  sections,
  status: RepoDocsStatus.READY,
  summary: null,
  title
})

describe('docs export helpers', () => {
  it('keeps modules and ready sections in the response order', () => {
    const document = assembleExportDocs([
      docsModule('second', 'Second module', [readySection(RepoDocsSectionKey.TESTING, 'Testing'), readySection(RepoDocsSectionKey.OVERVIEW, 'Overview')]),
      docsModule('first', 'First module', [readySection(RepoDocsSectionKey.ARCHITECTURE, 'Architecture')])
    ])

    expect(document.modules.map(item => item.key)).toEqual(['second', 'first'])
    expect(document.modules[0]?.sections.map(item => item.key)).toEqual([RepoDocsSectionKey.TESTING, RepoDocsSectionKey.OVERVIEW])
  })

  it('omits unavailable sections from content and lists them as not generated', () => {
    const unavailable = readySection(RepoDocsSectionKey.ARCHITECTURE, 'Architecture', '')
    unavailable.status = RepoDocsStatus.FAILED
    const document = assembleExportDocs([docsModule('core', 'Core', [readySection(RepoDocsSectionKey.OVERVIEW, 'Overview'), unavailable])])

    expect(document.modules[0]?.sections.map(item => item.title)).toEqual(['Overview'])
    expect(document.modules[0]?.unavailableSections.map(item => item.title)).toEqual(['Architecture'])
    expect(buildDocsMarkdown(document, 'Example')).toContain('- Architecture (failed)')
  })

  it('creates a valid empty document', () => {
    expect(buildDocsMarkdown(assembleExportDocs([]), 'Example')).toBe('# Example\n\nGenerated documentation\n\n## Table of contents\n')
  })

  it('demotes headings outside backtick fences without changing fence content', () => {
    const markdown = '# Title\n\n```bash\n# install deps\nnpm i\n```\n\n## Sub'

    expect(demoteMarkdownHeadings(markdown, 3)).toBe('#### Title\n\n```bash\n# install deps\nnpm i\n```\n\n##### Sub')
  })

  it('does not demote headings inside tilde fences', () => {
    expect(demoteMarkdownHeadings('~~~yaml\n# a YAML comment\n~~~\n# Heading', 2)).toBe('~~~yaml\n# a YAML comment\n~~~\n### Heading')
  })

  it('recognizes indented fences and longer closing fences', () => {
    expect(demoteMarkdownHeadings('   ````typescript\n# code comment\n   `````\n## Heading', 2)).toBe('   ````typescript\n# code comment\n   `````\n#### Heading')
  })

  it('keeps the rest of an unclosed fence unchanged', () => {
    expect(demoteMarkdownHeadings('~~~\n# protected\n## also protected', 3)).toBe('~~~\n# protected\n## also protected')
  })

  it('demotes markdown headings and caps them at h6 outside fences', () => {
    expect(demoteMarkdownHeadings('# One\n##### Five\n###### Six', 2)).toBe('### One\n###### Five\n###### Six')
  })

  it('returns text without headings unchanged', () => {
    expect(demoteMarkdownHeadings('Paragraph\n#hashtag\n- list item', 3)).toBe('Paragraph\n#hashtag\n- list item')
  })

  it('uses a repository slug or repository id fallback for downloads', () => {
    expect(getDocsFilename('My Repository!', 42)).toBe('my-repository-docs.md')
    expect(getDocsFilename('  ', 42)).toBe('repo-42-docs.md')
  })

  it('uses the shared slug logic for PDF downloads', () => {
    expect(getDocsFilenameWithExtension('My Repository!', 42, 'pdf')).toBe('my-repository-docs.pdf')
    expect(getDocsFilenameWithExtension('  ', 42, 'pdf')).toBe('repo-42-docs.pdf')
  })

  it('treats sections that only say the context was unknown as unavailable', () => {
    const unknown = { generatedAt: null, key: 'testing', markdown: 'Unknown from provided context.', status: RepoDocsStatus.READY, title: 'Testing' } as RepoDocsSection
    const real = { generatedAt: null, key: 'overview', markdown: 'Real content', status: RepoDocsStatus.READY, title: 'Overview' } as RepoDocsSection
    const document = assembleExportDocs([{ error: null, generatedAt: null, key: 'core', path: null, sections: [real, unknown], status: RepoDocsStatus.READY, summary: null, title: 'Core' }])

    expect(document.modules[0]?.sections.map(item => item.title)).toEqual(['Overview'])
    expect(document.modules[0]?.unavailableSections.map(item => item.title)).toEqual(['Testing'])
    expect(describeUnavailableSection(unknown)).toBe('no evidence in provided context')
    expect(describeUnavailableSection({ ...unknown, markdown: null, status: RepoDocsStatus.PENDING })).toBe('pending')
    expect(buildDocsMarkdown(document, 'Repo')).toContain('- Testing (no evidence in provided context)')
  })

  it('only treats a section as unknown-only when nothing but punctuation surrounds the marker', () => {
    const section = (markdown: string) => ({ generatedAt: null, key: 'testing', markdown, status: RepoDocsStatus.READY, title: 'Testing' }) as RepoDocsSection

    for (const markdown of ['Unknown from provided context.', '**Unknown from provided context**', '> Unknown from provided context —']) {
      expect(describeUnavailableSection(section(markdown))).toBe('no evidence in provided context')
    }

    for (const markdown of ['中文：Unknown from provided context。', 'Żółć — Unknown from provided context — 中文', 'Real text. Unknown from provided context']) {
      expect(describeUnavailableSection(section(markdown))).toBe('ready')
    }
  })

  it('detects stored documentation even when nothing is exportable', () => {
    const unknownOnly = { generatedAt: null, key: 'testing', markdown: 'Unknown from provided context.', status: RepoDocsStatus.READY, title: 'Testing' } as RepoDocsSection
    const emptyModule = { error: null, generatedAt: null, key: 'core', path: null, sections: [], status: RepoDocsStatus.PENDING, summary: null, title: 'Core' }

    expect(hasStoredDocumentation([])).toBe(false)
    expect(hasStoredDocumentation([emptyModule])).toBe(false)
    expect(hasStoredDocumentation([{ ...emptyModule, summary: 'A summary' }])).toBe(true)
    expect(hasStoredDocumentation([{ ...emptyModule, sections: [unknownOnly] }])).toBe(true)
  })
})
