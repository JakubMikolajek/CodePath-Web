import { RepoCloneStatus, RepoDocsStatus, RepoEmbeddingStatus } from '@workspace/codepath-common/repository'
import { describe, expect, it } from 'vitest'

import type { RepoDocsStatusResponse } from '@/redux/api/docsApi'

import { CONFIRMABLE_DOCS_ACTION_COPY, DOCS_GENERATION_POLL_MS, DOCS_STATUS_POLL_MS, getDocsPollInterval } from './docsUtils'

const status = (overrides: Partial<RepoDocsStatusResponse>): RepoDocsStatusResponse => ({
  cloneStatus: RepoCloneStatus.CLONED,
  docsProgress: null,
  docsStatus: RepoDocsStatus.READY,
  embeddingStatus: RepoEmbeddingStatus.EMBEDDED,
  id: 1,
  lastPipelineError: null,
  pipelineUpdatedAt: null,
  ...overrides
})

describe('getDocsPollInterval', () => {
  it('does not poll before the status is known or once everything is idle', () => {
    expect(getDocsPollInterval(undefined)).toBe(0)
    expect(getDocsPollInterval(status({}))).toBe(0)
  })

  it('polls quickly while documentation is being generated', () => {
    expect(getDocsPollInterval(status({ docsStatus: RepoDocsStatus.PROCESSING }))).toBe(DOCS_GENERATION_POLL_MS)
  })

  it('polls slowly while an earlier pipeline stage is still running', () => {
    expect(getDocsPollInterval(status({ embeddingStatus: RepoEmbeddingStatus.PROCESSING }))).toBe(DOCS_STATUS_POLL_MS)
    expect(getDocsPollInterval(status({ cloneStatus: RepoCloneStatus.CLONING }))).toBe(DOCS_STATUS_POLL_MS)
  })
})

describe('CONFIRMABLE_DOCS_ACTION_COPY', () => {
  it('warns about the deletion for every destructive action', () => {
    expect(Object.keys(CONFIRMABLE_DOCS_ACTION_COPY).sort()).toEqual(['clone', 'generate', 'ingest'])

    for (const copy of Object.values(CONFIRMABLE_DOCS_ACTION_COPY)) {
      expect(copy.description).toContain('deleted')
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.confirmLabel.length).toBeGreaterThan(0)
    }
  })
})
