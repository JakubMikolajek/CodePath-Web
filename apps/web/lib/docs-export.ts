import type { RepoDocsModule, RepoDocsSection } from '@workspace/codepath-common/repository'
import { RepoDocsStatus } from '@workspace/codepath-common/repository'

export interface ExportDocsModule {
  key: string
  sections: RepoDocsSection[]
  summary: null | string
  title: string
  unavailableSections: RepoDocsSection[]
}

export interface ExportDocsDocument {
  generatedAt: null | string
  modules: ExportDocsModule[]
}

const hasReadyMarkdown = (section: RepoDocsSection) => section.status === RepoDocsStatus.READY && Boolean(section.markdown?.trim())

export function assembleExportDocs(modules: RepoDocsModule[]): ExportDocsDocument {
  const generatedAt = modules.reduce<null | string>((latest, docsModule) => {
    if (!docsModule.generatedAt || (latest && new Date(docsModule.generatedAt) <= new Date(latest))) return latest

    return docsModule.generatedAt
  }, null)

  return {
    generatedAt,
    modules: modules.map(docsModule => ({
      key: docsModule.key,
      sections: docsModule.sections.filter(hasReadyMarkdown),
      summary: docsModule.summary?.trim() || null,
      title: docsModule.title,
      unavailableSections: docsModule.sections.filter(section => !hasReadyMarkdown(section))
    }))
  }
}

export function buildDocsMarkdown(document: ExportDocsDocument, repositoryName: string): string {
  const lines = [`# ${repositoryName}`, '', 'Generated documentation']

  if (document.generatedAt) lines.push('', `Generated: ${document.generatedAt}`)

  lines.push('', '## Table of contents', '')
  for (const docsModule of document.modules) lines.push(`- [${docsModule.title}](#${toAnchor(docsModule.title)})`)

  for (const docsModule of document.modules) {
    lines.push('', `## ${docsModule.title}`)

    if (docsModule.summary) lines.push('', demoteMarkdownHeadings(docsModule.summary, 2))

    for (const section of docsModule.sections) {
      lines.push('', `### ${section.title}`, '', demoteMarkdownHeadings(section.markdown ?? '', 3))
    }

    if (docsModule.unavailableSections.length) {
      lines.push('', '### Not generated', '')
      for (const section of docsModule.unavailableSections) lines.push(`- ${section.title} (${section.status.replaceAll('_', ' ')})`)
    }
  }

  return `${lines.join('\n').trim()}\n`
}

export function demoteMarkdownHeadings(markdown: string, levels: number): string {
  let fence: null | { character: '`' | '~'; length: number } = null

  return markdown.split('\n').map(line => {
    if (fence) {
      const closingFence = new RegExp(`^ {0,3}${fence.character}{${fence.length},}[\\t \\r]*$`)
      if (closingFence.test(line)) fence = null

      return line
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (openingFence) {
      fence = { character: openingFence[1][0] as '`' | '~', length: openingFence[1].length }

      return line
    }

    return line.replace(/^(#{1,6})(?=\s)/, heading => '#'.repeat(Math.min(6, heading.length + levels)))
  }).join('\n')
}

export function getDocsFilename(repositoryName: null | string | undefined, repoId: number): string {
  return getDocsFilenameWithExtension(repositoryName, repoId, 'md')
}

export function getDocsFilenameWithExtension(repositoryName: null | string | undefined, repoId: number, extension: string): string {
  const slug = slugify(repositoryName) || `repo-${repoId}`

  return `${slug}-docs.${extension}`
}

function slugify(value: null | string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ?? ''
}

function toAnchor(value: string): string {
  return slugify(value)
}
