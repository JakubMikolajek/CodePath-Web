import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'
import {
  REPO_DOCS_SECTION_ORDER,
  REPO_DOCS_SECTION_TITLES,
  RepoEmbeddingStatus,
  RepoDocsGenerationScope,
  RepoDocsProgressStage,
  RepoDocsSectionKey,
  RepoDocsStatus,
  RepoDocsFragmentType,
  type RepoDocsJobRequest,
  type RepoDocsModule,
  type RepoDocsProgress,
  type RepoDocsSection
} from '@workspace/codepath-common/repository'
import { and, asc, eq, ne } from 'drizzle-orm'

import { repoDocsFragments, repos, type SelectRepoDocsFragment } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { OrchestratorClient } from '../../orchestrator-client/services/orchestrator-client.service'
import { emitTelemetry } from '../../telemetry/services/telemetry'

const nowIso = () => new Date().toISOString()
type RepoDocsStatusValue = `${RepoDocsStatus}`
const REPOSITORY_DOCS_MODULE_KEY = 'repository'

interface GenerateDocumentationTarget {
  moduleKey?: string
  sectionKey?: RepoDocsSectionKey
}

const LEGACY_HEADING_TO_SECTION: Array<{ key: RepoDocsSectionKey, patterns: RegExp[] }> = [
  { key: RepoDocsSectionKey.OVERVIEW, patterns: [/^project overview$/i, /^overview$/i, /^project documentation$/i] },
  { key: RepoDocsSectionKey.ARCHITECTURE, patterns: [/^architecture$/i] },
  { key: RepoDocsSectionKey.KEY_COMPONENTS, patterns: [/^key components$/i, /^components$/i, /^data models$/i] },
  { key: RepoDocsSectionKey.DATA_FLOW, patterns: [/^data flow$/i] },
  { key: RepoDocsSectionKey.PUBLIC_INTERFACES, patterns: [/^api reference$/i, /^public interfaces$/i, /^api$/i] },
  { key: RepoDocsSectionKey.CONFIGURATION, patterns: [/^configuration$/i] },
  { key: RepoDocsSectionKey.OPERATIONS, patterns: [/^operations$/i] },
  { key: RepoDocsSectionKey.TESTING, patterns: [/^testing$/i, /^test coverage$/i] },
  { key: RepoDocsSectionKey.RISKS_LIMITATIONS, patterns: [/^known risks$/i, /^risks?(&| and )limitations$/i, /^assumptions and unknowns$/i] }
]

@Injectable()
export class DocsService {
  constructor(
    private readonly dbService: DbService,
    private readonly orchestratorClient: OrchestratorClient
  ) { }

  async generateDocumentation(userId: number, repoId: number, target: GenerateDocumentationTarget = {}) {
    const repo = await this.assertRepoOwnership(userId, repoId)
    const docsJob = this.createDocsJobRequest(repoId, target)

    if (repo.cloneStatus !== 'cloned') throw new ConflictException(`Repository clone is not ready for documentation generation (cloneStatus=${repo.cloneStatus})`)

    if (repo.embeddingStatus !== 'embedded') {
      emitTelemetry({
        component: 'docs.service',
        details: { embeddingStatus: repo.embeddingStatus },
        event: 'docs_job_blocked_embedding_not_ready',
        level: TelemetryLevel.WARN,
        repoId: repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })

      throw new ConflictException(this.embeddingStatusGateMessage(repo.embeddingStatus))
    }

    if (repo.docsStatus === 'processing') return { message: 'Documentation generation already in progress', status: 'processing' }

    const [claimedRepo] = await this.dbService.dbClient.update(repos).set({
      docsStatus: 'processing',
      docsProgressCurrent: 0,
      docsProgressMessage: this.createDocsProgressMessage(docsJob, RepoDocsProgressStage.QUEUED),
      docsProgressModuleKey: docsJob.moduleKey ?? null,
      docsProgressScope: docsJob.scope ?? RepoDocsGenerationScope.REPOSITORY,
      docsProgressSectionKey: docsJob.sectionKey ?? null,
      docsProgressStage: RepoDocsProgressStage.QUEUED,
      docsProgressTotal: null,
      docsProgressUpdatedAt: nowIso(),
      lastPipelineError: null,
      pipelineUpdatedAt: nowIso(),
      ...(docsJob.scope === RepoDocsGenerationScope.REPOSITORY ? { documentation: null } : {})
    }).where(and(
      eq(repos.id, repoId),
      eq(repos.userId, userId),
      ne(repos.docsStatus, 'processing')
    )).returning({ id: repos.id })

    if (!claimedRepo) return { message: 'Documentation generation already in progress', status: 'processing' }

    if (docsJob.scope === RepoDocsGenerationScope.REPOSITORY) {
      await this.dbService.dbClient.delete(repoDocsFragments).where(eq(repoDocsFragments.repoId, repoId))
    } else {
      await this.ensureScopedFragmentPlaceholder(repoId, docsJob)
      await this.markScopedFragmentsStatus(repoId, docsJob, RepoDocsStatus.PROCESSING, null)
    }

    try {
      await this.orchestratorClient.enqueueDocsJob(docsJob)
      emitTelemetry({
        component: 'docs.service',
        event: 'docs_job_published',
        level: TelemetryLevel.INFO,
        queueName: 'docs',
        repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.OK,
        details: {
          moduleKey: docsJob.moduleKey ?? null,
          scope: docsJob.scope ?? RepoDocsGenerationScope.REPOSITORY,
          sectionKey: docsJob.sectionKey ?? null
        }
      })
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : String(cause)

      await this.dbService.dbClient.update(repos).set({
        docsStatus: 'failed',
        docsProgressMessage: errorMessage,
        docsProgressStage: RepoDocsProgressStage.FAILED,
        docsProgressUpdatedAt: nowIso(),
        lastPipelineError: errorMessage,
        pipelineUpdatedAt: nowIso()
      }).where(and(eq(repos.id, repoId), eq(repos.userId, userId)))

      if (docsJob.scope !== RepoDocsGenerationScope.REPOSITORY) {
        await this.markScopedFragmentsStatus(repoId, docsJob, RepoDocsStatus.FAILED, errorMessage)
      }

      emitTelemetry({
        component: 'docs.service',
        details: {
          errorMessage,
          errorName: cause instanceof Error ? cause.name : 'UnknownError'
        },
        event: 'docs_job_publish_failed',
        level: TelemetryLevel.ERROR,
        queueName: 'docs',
        repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })
      throw cause
    }

    return { message: 'Documentation generation started', status: 'processing' }
  }

  async getDocumentation(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [repo] = await this.dbService.dbClient.select().from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    return repo?.documentation
  }

  async getDocumentationStatus(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsProgressCurrent: repos.docsProgressCurrent,
      docsProgressMessage: repos.docsProgressMessage,
      docsProgressModuleKey: repos.docsProgressModuleKey,
      docsProgressScope: repos.docsProgressScope,
      docsProgressSectionKey: repos.docsProgressSectionKey,
      docsProgressStage: repos.docsProgressStage,
      docsProgressTotal: repos.docsProgressTotal,
      docsProgressUpdatedAt: repos.docsProgressUpdatedAt,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id,
      lastPipelineError: repos.lastPipelineError,
      pipelineUpdatedAt: repos.pipelineUpdatedAt
    }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    return {
      cloneStatus: repo.cloneStatus,
      docsProgress: this.toDocsProgress(repo),
      docsStatus: repo.docsStatus,
      embeddingStatus: repo.embeddingStatus,
      id: repo.id,
      lastPipelineError: repo.lastPipelineError,
      pipelineUpdatedAt: repo.pipelineUpdatedAt
    }
  }

  async getDocumentationModules(userId: number, repoId: number): Promise<RepoDocsModule[]> {
    const [repo] = await this.dbService.dbClient.select({
      docsStatus: repos.docsStatus,
      documentation: repos.documentation,
      id: repos.id,
      pipelineUpdatedAt: repos.pipelineUpdatedAt
    }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    const fragments = await this.dbService.dbClient.select().from(repoDocsFragments)
      .where(eq(repoDocsFragments.repoId, repoId))
      .orderBy(
        asc(repoDocsFragments.moduleKey),
        asc(repoDocsFragments.fragmentType),
        asc(repoDocsFragments.fragmentKey)
      )
    const modules = this.buildModulesFromFragments(fragments)
    if (modules.length > 0) return modules

    const documentation = (repo.documentation ?? '').trim()
    if (repo.docsStatus === RepoDocsStatus.READY && documentation) {
      return [this.createRepositoryModule(this.deriveSectionsFromMarkdown(documentation, repo.pipelineUpdatedAt), RepoDocsStatus.READY, repo.pipelineUpdatedAt)]
    }

    return [this.createRepositoryModule(this.createSectionSkeleton(repo.docsStatus), repo.docsStatus, null)]
  }

  private async assertRepoOwnership(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id
    }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    return repo
  }

  private createDocsJobRequest(repoId: number, target: GenerateDocumentationTarget): RepoDocsJobRequest {
    if (target.sectionKey && !REPO_DOCS_SECTION_ORDER.includes(target.sectionKey)) {
      throw new ConflictException(`Unsupported documentation section: ${target.sectionKey}`)
    }

    if (target.sectionKey && !target.moduleKey) {
      throw new ConflictException('Section documentation generation requires a module key')
    }

    if (target.moduleKey && target.moduleKey.trim().length === 0) {
      throw new ConflictException('Module key must not be empty')
    }

    if (target.sectionKey) {
      return {
        forceRegenerateDocs: true,
        moduleKey: target.moduleKey,
        repoId,
        scope: RepoDocsGenerationScope.SECTION,
        sectionKey: target.sectionKey
      }
    }

    if (target.moduleKey) {
      return {
        forceRegenerateDocs: true,
        moduleKey: target.moduleKey,
        repoId,
        scope: RepoDocsGenerationScope.MODULE
      }
    }

    return {
      forceRegenerateDocs: true,
      repoId,
      scope: RepoDocsGenerationScope.REPOSITORY
    }
  }

  private createDocsProgressMessage(docsJob: RepoDocsJobRequest, stage: RepoDocsProgressStage): string {
    const scope = docsJob.scope ?? RepoDocsGenerationScope.REPOSITORY

    if (stage === RepoDocsProgressStage.QUEUED) {
      if (scope === RepoDocsGenerationScope.SECTION) return `Queued documentation section ${docsJob.sectionKey} for module ${docsJob.moduleKey}`
      if (scope === RepoDocsGenerationScope.MODULE) return `Queued documentation module ${docsJob.moduleKey}`
      return 'Queued repository documentation'
    }

    return stage.replaceAll('_', ' ')
  }

  private toDocsProgress(row: {
    docsProgressCurrent: number | null
    docsProgressMessage: string | null
    docsProgressModuleKey: string | null
    docsProgressScope: string | null
    docsProgressSectionKey: string | null
    docsProgressStage: string | null
    docsProgressTotal: number | null
    docsProgressUpdatedAt: string | null
  }): RepoDocsProgress | null {
    if (!row.docsProgressStage && !row.docsProgressMessage) return null

    const scope = Object.values(RepoDocsGenerationScope).includes(row.docsProgressScope as RepoDocsGenerationScope)
      ? row.docsProgressScope as RepoDocsGenerationScope
      : null
    const stage = Object.values(RepoDocsProgressStage).includes(row.docsProgressStage as RepoDocsProgressStage)
      ? row.docsProgressStage as RepoDocsProgressStage
      : null
    const sectionKey = REPO_DOCS_SECTION_ORDER.includes(row.docsProgressSectionKey as RepoDocsSectionKey)
      ? row.docsProgressSectionKey as RepoDocsSectionKey
      : null

    return {
      current: row.docsProgressCurrent,
      message: row.docsProgressMessage,
      moduleKey: row.docsProgressModuleKey,
      scope,
      sectionKey,
      stage,
      total: row.docsProgressTotal,
      updatedAt: row.docsProgressUpdatedAt
    }
  }

  private async markScopedFragmentsStatus(
    repoId: number,
    docsJob: RepoDocsJobRequest,
    status: RepoDocsStatus,
    error: string | null
  ) {
    if (!docsJob.moduleKey) return

    const predicates = [
      eq(repoDocsFragments.repoId, repoId),
      eq(repoDocsFragments.moduleKey, docsJob.moduleKey)
    ]

    if (docsJob.sectionKey) {
      predicates.push(eq(repoDocsFragments.fragmentType, RepoDocsFragmentType.SECTION))
      predicates.push(eq(repoDocsFragments.sectionKey, docsJob.sectionKey))
    }

    await this.dbService.dbClient.update(repoDocsFragments).set({
      error,
      status,
      updatedAt: nowIso()
    }).where(and(...predicates))
  }

  private async ensureScopedFragmentPlaceholder(repoId: number, docsJob: RepoDocsJobRequest) {
    if (!docsJob.moduleKey) return

    const now = nowIso()
    const isSection = Boolean(docsJob.sectionKey)
    const fragmentKey = docsJob.sectionKey ?? '__module_summary__'
    const fragmentType = isSection ? RepoDocsFragmentType.SECTION : RepoDocsFragmentType.MODULE_SUMMARY

    await this.dbService.dbClient.insert(repoDocsFragments).values({
      error: null,
      fragmentKey,
      fragmentType,
      generatedAt: null,
      markdown: null,
      moduleKey: docsJob.moduleKey,
      modulePath: null,
      moduleTitle: this.moduleTitleFromKey(docsJob.moduleKey),
      repoId,
      sectionKey: docsJob.sectionKey ?? null,
      sectionTitle: docsJob.sectionKey ? REPO_DOCS_SECTION_TITLES[docsJob.sectionKey] : null,
      status: RepoDocsStatus.PROCESSING,
      updatedAt: now
    }).onConflictDoUpdate({
      set: {
        error: null,
        status: RepoDocsStatus.PROCESSING,
        updatedAt: now
      },
      target: [
        repoDocsFragments.repoId,
        repoDocsFragments.moduleKey,
        repoDocsFragments.fragmentType,
        repoDocsFragments.fragmentKey
      ]
    })
  }

  private moduleTitleFromKey(moduleKey: string) {
    if (moduleKey === REPOSITORY_DOCS_MODULE_KEY) return 'Repository'

    const lastSegment = moduleKey.split(/[/_]+/).filter(Boolean).at(-1)
    if (!lastSegment) return moduleKey

    return lastSegment.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
  }

  private embeddingStatusGateMessage(status: RepoEmbeddingStatus) {
    switch (status) {
      case RepoEmbeddingStatus.FAILED:
        return 'Embeddings failed. Re-run embedding before generating documentation.'
      case RepoEmbeddingStatus.PENDING:
        return 'Embeddings are pending. Start embedding before generating documentation.'
      case RepoEmbeddingStatus.PROCESSING:
        return 'Embeddings are still processing. Wait for completion before generating documentation.'
      case RepoEmbeddingStatus.EMBEDDED:
        return 'Embeddings are ready for documentation generation.'
    }
  }

  private createSectionSkeleton(status: RepoDocsStatusValue): RepoDocsSection[] {
    const sectionStatus = status === RepoDocsStatus.PROCESSING
      ? RepoDocsStatus.PROCESSING
      : status === RepoDocsStatus.FAILED
        ? RepoDocsStatus.FAILED
        : RepoDocsStatus.PENDING

    return REPO_DOCS_SECTION_ORDER.map(key => ({
      error: status === RepoDocsStatus.FAILED ? 'Documentation generation failed.' : null,
      generatedAt: null,
      key,
      markdown: null,
      status: sectionStatus,
      title: REPO_DOCS_SECTION_TITLES[key]
    }))
  }

  private deriveSectionsFromMarkdown(markdown: string, generatedAt: string | null): RepoDocsSection[] {
    const buckets = new Map<RepoDocsSectionKey, string[]>()
    const chunks = this.splitMarkdownByHeadings(markdown)

    if (chunks.length === 0) buckets.set(RepoDocsSectionKey.OVERVIEW, [markdown])

    for (const chunk of chunks) {
      const key = this.resolveSectionKey(chunk.heading)
      buckets.set(key, [...(buckets.get(key) ?? []), chunk.markdown])
    }

    return REPO_DOCS_SECTION_ORDER.map(key => {
      const content = (buckets.get(key) ?? []).join('\n\n').trim()

      return {
        error: null,
        generatedAt,
        key,
        markdown: content || null,
        status: content ? RepoDocsStatus.READY : RepoDocsStatus.PENDING,
        title: REPO_DOCS_SECTION_TITLES[key]
      }
    })
  }

  private createRepositoryModule(sections: RepoDocsSection[], status: RepoDocsStatusValue, generatedAt: string | null): RepoDocsModule {
    const moduleStatus = sections.some(section => section.status === RepoDocsStatus.READY)
      ? RepoDocsStatus.READY
      : status === RepoDocsStatus.PROCESSING
        ? RepoDocsStatus.PROCESSING
        : status === RepoDocsStatus.FAILED
          ? RepoDocsStatus.FAILED
          : RepoDocsStatus.PENDING

    return {
      error: moduleStatus === RepoDocsStatus.FAILED ? 'Documentation generation failed.' : null,
      generatedAt,
      key: REPOSITORY_DOCS_MODULE_KEY,
      path: null,
      sections,
      status: moduleStatus,
      summary: null,
      title: 'Repository'
    }
  }

  private buildModulesFromFragments(fragments: SelectRepoDocsFragment[]): RepoDocsModule[] {
    const byModule = new Map<string, {
      error: string | null
      generatedAt: string | null
      key: string
      path: string | null
      sections: RepoDocsSection[]
      status: RepoDocsStatus
      summary: string | null
      title: string
    }>()

    for (const fragment of fragments) {
      const existingModule = byModule.get(fragment.moduleKey) ?? {
        error: null,
        generatedAt: null,
        key: fragment.moduleKey,
        path: fragment.modulePath ?? null,
        sections: [],
        status: RepoDocsStatus.PENDING,
        summary: null,
        title: fragment.moduleTitle
      }

      existingModule.error ??= fragment.error ?? null
      existingModule.generatedAt ??= fragment.generatedAt ?? null
      existingModule.path ??= fragment.modulePath ?? null

      if (fragment.fragmentType === RepoDocsFragmentType.MODULE_SUMMARY) {
        existingModule.summary = fragment.markdown ?? null
        existingModule.status = this.mergeDocsStatus(existingModule.status, this.toDocsStatus(fragment.status))
        byModule.set(fragment.moduleKey, existingModule)
        continue
      }

      if (!fragment.sectionKey || !REPO_DOCS_SECTION_ORDER.includes(fragment.sectionKey)) {
        byModule.set(fragment.moduleKey, existingModule)
        continue
      }

      existingModule.sections.push({
        error: fragment.error ?? null,
        generatedAt: fragment.generatedAt ?? null,
        key: fragment.sectionKey,
        markdown: fragment.markdown ?? null,
        status: this.toDocsStatus(fragment.status),
        title: fragment.sectionTitle || REPO_DOCS_SECTION_TITLES[fragment.sectionKey]
      })
      existingModule.status = this.mergeDocsStatus(existingModule.status, this.toDocsStatus(fragment.status))
      byModule.set(fragment.moduleKey, existingModule)
    }

    return [...byModule.values()].map(module => {
      const sectionsByKey = new Map(module.sections.map(section => [section.key, section]))

      return {
        error: module.error,
        generatedAt: module.generatedAt,
        key: module.key,
        path: module.path,
        sections: REPO_DOCS_SECTION_ORDER.map(key => sectionsByKey.get(key) ?? {
          error: null,
          generatedAt: null,
          key,
          markdown: null,
          status: RepoDocsStatus.PENDING,
          title: REPO_DOCS_SECTION_TITLES[key]
        }),
        status: module.status,
        summary: module.summary,
        title: module.title
      }
    })
  }

  private normalizeStoredSections(value: unknown): RepoDocsSection[] {
    if (!Array.isArray(value)) return []

    const byKey = new Map<RepoDocsSectionKey, RepoDocsSection>()

    for (const item of value) {
      if (!this.isDocsSection(item)) continue
      byKey.set(item.key, {
        error: item.error ?? null,
        generatedAt: item.generatedAt ?? null,
        key: item.key,
        markdown: item.markdown ?? null,
        status: item.status,
        title: item.title || REPO_DOCS_SECTION_TITLES[item.key]
      })
    }

    if (byKey.size === 0) return []

    return REPO_DOCS_SECTION_ORDER.map(key => byKey.get(key) ?? {
      error: null,
      generatedAt: null,
      key,
      markdown: null,
      status: RepoDocsStatus.PENDING,
      title: REPO_DOCS_SECTION_TITLES[key]
    })
  }

  private mergeDocsStatus(current: RepoDocsStatus, next: RepoDocsStatus): RepoDocsStatus {
    if (current === RepoDocsStatus.FAILED || next === RepoDocsStatus.FAILED) return RepoDocsStatus.FAILED
    if (current === RepoDocsStatus.PROCESSING || next === RepoDocsStatus.PROCESSING) return RepoDocsStatus.PROCESSING
    if (current === RepoDocsStatus.READY || next === RepoDocsStatus.READY) return RepoDocsStatus.READY

    return RepoDocsStatus.PENDING
  }

  private toDocsStatus(status: RepoDocsStatusValue): RepoDocsStatus {
    return Object.values(RepoDocsStatus).includes(status as RepoDocsStatus)
      ? status as RepoDocsStatus
      : RepoDocsStatus.PENDING
  }

  private splitMarkdownByHeadings(markdown: string): Array<{ heading: string, markdown: string }> {
    const lines = markdown.split(/\r?\n/)
    const chunks: Array<{ heading: string, lines: string[] }> = []
    let current: { heading: string, lines: string[] } | null = null

    for (const line of lines) {
      const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line)

      if (match) {
        current = { heading: match[2].trim(), lines: [line] }
        chunks.push(current)
        continue
      }

      current?.lines.push(line)
    }

    return chunks.map(chunk => ({
      heading: chunk.heading,
      markdown: chunk.lines.join('\n').trim()
    })).filter(chunk => chunk.markdown.length > 0)
  }

  private resolveSectionKey(heading: string): RepoDocsSectionKey {
    const normalized = heading.replaceAll('#', '').trim()

    for (const candidate of LEGACY_HEADING_TO_SECTION) {
      if (candidate.patterns.some(pattern => pattern.test(normalized))) return candidate.key
    }

    return RepoDocsSectionKey.OVERVIEW
  }

  private isDocsSection(value: unknown): value is RepoDocsSection {
    if (typeof value !== 'object' || value === null) return false

    const candidate = value as Partial<RepoDocsSection>

    return typeof candidate.key === 'string'
      && REPO_DOCS_SECTION_ORDER.includes(candidate.key as RepoDocsSectionKey)
      && typeof candidate.title === 'string'
      && typeof candidate.status === 'string'
      && Object.values(RepoDocsStatus).includes(candidate.status as RepoDocsStatus)
  }

}
