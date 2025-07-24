import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { dependencies, docsSegments, embeddings, repos } from './index'

export const files = pgTable('files', {
  id: serial().primaryKey().notNull(),
  repoId: integer('repo_id').notNull(),
  path: text().notNull(),
  lastModified: timestamp('last_modified', { mode: 'string' }),
  hash: text(),
}, table => [
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'files_repo_id_fkey',
  }).onDelete('cascade'),
])

export const filesRelations = relations(files, ({ one, many }) => ({
  docsSegments: many(docsSegments),
  repo: one(repos, {
    fields: [files.repoId],
    references: [repos.id],
  }),
  embeddings: many(embeddings),
  dependencies: many(dependencies),
}))

export type SelectFile = InferSelectModel<typeof files>
export type InsertFile = InferInsertModel<typeof files>
