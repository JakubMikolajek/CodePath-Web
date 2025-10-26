import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { files, repos } from './index'

export const dependencies = pgTable('dependencies', {
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  fileId: integer('file_id').notNull(),
  fileName: text('file_name'),
  graph: text(),
  id: serial().primaryKey().notNull(),
  repoId: integer('repo_id').notNull()
}, table => [
  index('idx_dependencies_file_id').using('btree', table.fileId.asc().nullsLast().op('int4_ops')),
  index('idx_dependencies_repo_id').using('btree', table.repoId.asc().nullsLast().op('int4_ops')),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'dependencies_repo_id_fkey'
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'dependencies_file_id_fkey'
  }).onDelete('cascade')
])

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  file: one(files, {
    fields: [dependencies.fileId],
    references: [files.id]
  }),
  repo: one(repos, {
    fields: [dependencies.repoId],
    references: [repos.id]
  })
}))

export type SelectDependencies = InferSelectModel<typeof dependencies>
export type InsertDependencies = InferInsertModel<typeof dependencies>
