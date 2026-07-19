import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { repos } from './index'

export const docsSummaryCache = pgTable('docs_summary_cache', {
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  filePath: text('file_path').notNull(),
  id: serial().primaryKey().notNull(),
  repoId: integer('repo_id').notNull(),
  summary: text().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull()
}, table => [
  index('idx_docs_summary_cache_repo_id').using('btree', table.repoId.asc().nullsLast().op('int4_ops')),
  unique('uq_docs_summary_cache_repo_file_path').on(table.repoId, table.filePath),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'docs_summary_cache_repo_id_fkey'
  }).onDelete('cascade')
])

export const docsSummaryCacheRelations = relations(docsSummaryCache, ({ one }) => ({
  repo: one(repos, {
    fields: [docsSummaryCache.repoId],
    references: [repos.id]
  })
}))

export type SelectDocsSummaryCache = InferSelectModel<typeof docsSummaryCache>
export type InsertDocsSummaryCache = InferInsertModel<typeof docsSummaryCache>
