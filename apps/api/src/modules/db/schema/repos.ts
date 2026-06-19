import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { RepoEmbeddingStatus } from '@workspace/codepath-common/repository'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { apiRunnerAuthPresets, apiRunnerCollections, chatSessions, dependencies, files, users } from './index'

export const repoCloneStatusEnum = pgEnum('repo_clone_status', ['pending', 'cloning', 'cloned', 'failed'])
export const repoEmbeddingStatusEnum = pgEnum('repo_embedding_status', ['pending', 'processing', 'embedded', 'failed'])
export const repoDocsStatusEnum = pgEnum('repo_docs_status', ['pending', 'processing', 'ready', 'failed'])
export const repoStorageProviderEnum = pgEnum('repo_storage_provider', ['local', 'minio'])
export const repoGitAuthTypeEnum = pgEnum('repo_git_auth_type', ['none', 'https_token', 'ssh_key'])

export const repos = pgTable('repos', {
  accessKey: text('access_key'),
  cloneStatus: repoCloneStatusEnum('clone_status').default('pending').notNull(),
  defaultBranch: text('default_branch'),
  docsProgressCurrent: integer('docs_progress_current'),
  docsProgressMessage: text('docs_progress_message'),
  docsProgressModuleKey: text('docs_progress_module_key'),
  docsProgressScope: text('docs_progress_scope'),
  docsProgressSectionKey: text('docs_progress_section_key'),
  docsProgressStage: text('docs_progress_stage'),
  docsProgressTotal: integer('docs_progress_total'),
  docsProgressUpdatedAt: timestamp('docs_progress_updated_at', { mode: 'string' }),
  docsStatus: repoDocsStatusEnum('docs_status').default('pending').notNull(),
  documentation: text('documentation'),
  embeddingStatus: repoEmbeddingStatusEnum('embedding_status').$type<RepoEmbeddingStatus>().default(RepoEmbeddingStatus.PENDING).notNull(),
  gitAuthSecret: text('git_auth_secret'),
  gitAuthType: repoGitAuthTypeEnum('git_auth_type').default('none').notNull(),
  gitAuthUsername: text('git_auth_username'),
  gitUrl: text('git_url').notNull(),
  id: serial().primaryKey().notNull(),
  indexedAt: timestamp('indexed_at', { mode: 'string' }).defaultNow(),
  lastPipelineError: text('last_pipeline_error'),
  name: text().notNull(),
  path: text(),
  pipelineUpdatedAt: timestamp('pipeline_updated_at', { mode: 'string' }).defaultNow(),
  sourceCommitSha: text('source_commit_sha'),
  storageBucket: text('storage_bucket'),
  storageKey: text('storage_key'),
  storageProvider: repoStorageProviderEnum('storage_provider').default('local').notNull(),
  userId: integer('user_id').notNull()
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'repos_user_id_fkey'
  }).onDelete('cascade')
])

export const reposRelations = relations(repos, ({ many, one }) => ({
  apiRunnerAuthPresets: many(apiRunnerAuthPresets),
  apiRunnerCollections: many(apiRunnerCollections),
  chatSessions: many(chatSessions),
  dependencies: many(dependencies),
  files: many(files),
  user: one(users, {
    fields: [repos.userId],
    references: [users.id]
  })
}))

export type SelectRepo = InferSelectModel<typeof repos>
export type InsertRepo = InferInsertModel<typeof repos>
