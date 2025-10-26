import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { dependencies, docsSegments, embeddings, repos } from './index'

export const files = pgTable('files', {
  hash: text(),
  id: serial().primaryKey().notNull(),
  lastModified: timestamp('last_modified', { mode: 'string' }),
  path: text().notNull(),
  repoId: integer('repo_id').notNull()
}, table => [
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'files_repo_id_fkey'
  }).onDelete('cascade')
])

export const filesRelations = relations(files, ({ many, one }) => ({
  dependencies: many(dependencies),
  docsSegments: many(docsSegments),
  embeddings: many(embeddings),
  repo: one(repos, {
    fields: [files.repoId],
    references: [repos.id]
  })
}))

export type SelectFile = InferSelectModel<typeof files>
export type InsertFile = InferInsertModel<typeof files>
