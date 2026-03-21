import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { chatSessions, dependencies, files, users } from './index'

export const repoCloneStatusEnum = pgEnum('repo_clone_status', ['pending', 'cloning', 'cloned', 'failed'])
export const repoEmbeddingStatusEnum = pgEnum('repo_embedding_status', ['pending', 'processing', 'embedded', 'failed'])
export const repoStorageProviderEnum = pgEnum('repo_storage_provider', ['local', 'minio'])

export const repos = pgTable('repos', {
  accessKey: text('access_key'),
  cloneStatus: repoCloneStatusEnum('clone_status').default('pending').notNull(),
  embeddingStatus: repoEmbeddingStatusEnum('embedding_status').default('pending').notNull(),
  gitUrl: text('git_url').notNull(),
  id: serial().primaryKey().notNull(),
  indexedAt: timestamp('indexed_at', { mode: 'string' }).defaultNow(),
  name: text().notNull(),
  path: text(),
  sourceCommitSha: text('source_commit_sha'),
  storageBucket: text('storage_bucket'),
  storageKey: text('storage_key'),
  storageProvider: repoStorageProviderEnum('storage_provider').default('local').notNull(),
  userId: integer('user_id').notNull(),
  documentation: text('documentation')
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'repos_user_id_fkey'
  }).onDelete('cascade')
])

export const reposRelations = relations(repos, ({ many, one }) => ({
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
