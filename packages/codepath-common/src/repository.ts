import { Nullable } from './globals'

export enum RepoCloneStatus {
  CLONED = 'cloned',
  CLONING = 'cloning',
  FAILED = 'failed',
  PENDING = 'pending'
}

export enum RepoEmbeddingStatus {
  EMBEDDED = 'embedded',
  FAILED = 'failed',
  PENDING = 'pending',
  PROCESSING = 'processing'
}

export enum RepoDocsStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready'
}

export enum RepoDocsFragmentType {
  MODULE_SUMMARY = 'module_summary',
  SECTION = 'section'
}

export enum RepoDocsGenerationScope {
  MODULE = 'module',
  REPOSITORY = 'repository',
  SECTION = 'section'
}

export enum RepoDocsProgressStage {
  COMPLETED = 'completed',
  FAILED = 'failed',
  FILE_SUMMARIES = 'file_summaries',
  MODULE_SYNTHESIS = 'module_synthesis',
  PROJECT_SYNTHESIS = 'project_synthesis',
  QUALITY_EVALUATION = 'quality_evaluation',
  QUEUED = 'queued',
  SAVING = 'saving',
  STARTING = 'starting'
}

export enum RepoDocsSectionKey {
  ARCHITECTURE = 'architecture',
  CONFIGURATION = 'configuration',
  DATA_FLOW = 'data_flow',
  KEY_COMPONENTS = 'key_components',
  OPERATIONS = 'operations',
  OVERVIEW = 'overview',
  PUBLIC_INTERFACES = 'public_interfaces',
  RISKS_LIMITATIONS = 'risks_limitations',
  TESTING = 'testing'
}

export const REPO_DOCS_SECTION_ORDER: RepoDocsSectionKey[] = [
  RepoDocsSectionKey.OVERVIEW,
  RepoDocsSectionKey.ARCHITECTURE,
  RepoDocsSectionKey.KEY_COMPONENTS,
  RepoDocsSectionKey.DATA_FLOW,
  RepoDocsSectionKey.PUBLIC_INTERFACES,
  RepoDocsSectionKey.CONFIGURATION,
  RepoDocsSectionKey.OPERATIONS,
  RepoDocsSectionKey.TESTING,
  RepoDocsSectionKey.RISKS_LIMITATIONS
]

export const REPO_DOCS_SECTION_TITLES: Record<RepoDocsSectionKey, string> = {
  [RepoDocsSectionKey.ARCHITECTURE]: 'Architecture',
  [RepoDocsSectionKey.CONFIGURATION]: 'Configuration',
  [RepoDocsSectionKey.DATA_FLOW]: 'Data Flow',
  [RepoDocsSectionKey.KEY_COMPONENTS]: 'Key Components',
  [RepoDocsSectionKey.OPERATIONS]: 'Operations',
  [RepoDocsSectionKey.OVERVIEW]: 'Overview',
  [RepoDocsSectionKey.PUBLIC_INTERFACES]: 'Public Interfaces',
  [RepoDocsSectionKey.RISKS_LIMITATIONS]: 'Risks & Limitations',
  [RepoDocsSectionKey.TESTING]: 'Testing'
}

export interface RepoDocsSection {
  error?: Nullable<string>
  generatedAt: Nullable<string>
  key: RepoDocsSectionKey
  markdown: Nullable<string>
  status: RepoDocsStatus
  title: string
}

export interface RepoDocsModule {
  error?: Nullable<string>
  generatedAt: Nullable<string>
  key: string
  path: Nullable<string>
  sections: RepoDocsSection[]
  status: RepoDocsStatus
  summary: Nullable<string>
  title: string
}

export interface RepoDocsFragment {
  error: Nullable<string>
  fragmentKey: string
  generatedAt: Nullable<string>
  id: number
  markdown: Nullable<string>
  moduleKey: string
  modulePath: Nullable<string>
  moduleTitle: string
  repoId: number
  sectionKey: Nullable<RepoDocsSectionKey>
  sectionTitle: Nullable<string>
  status: RepoDocsStatus
  type: RepoDocsFragmentType
}

export interface RepoDocsJobRequest {
  forceRegenerateDocs?: boolean
  moduleKey?: string
  repoId: number
  scope?: RepoDocsGenerationScope
  sectionKey?: RepoDocsSectionKey
}

export interface RepoEvaluationJobRequest {
  repoId: number
  runType: string
}

export interface RepoDocsProgress {
  current: Nullable<number>
  message: Nullable<string>
  moduleKey: Nullable<string>
  scope: Nullable<RepoDocsGenerationScope>
  sectionKey: Nullable<RepoDocsSectionKey>
  stage: Nullable<RepoDocsProgressStage>
  total: Nullable<number>
  updatedAt: Nullable<string>
}

export interface Repository {
  id: number
  name: string
  cloneStatus: RepoCloneStatus
  embeddingStatus: RepoEmbeddingStatus
  docsStatus: RepoDocsStatus
  pipelineUpdatedAt: Nullable<string>
  lastPipelineError: Nullable<string>
  docsProgress?: Nullable<RepoDocsProgress>
}
