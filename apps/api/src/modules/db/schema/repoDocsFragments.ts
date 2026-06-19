import type { RepoDocsFragmentType, RepoDocsSectionKey } from '@workspace/codepath-common/repository'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgEnum, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { repos, repoDocsStatusEnum } from './repos'

export const repoDocsFragmentTypeEnum = pgEnum('repo_docs_fragment_type', ['module_summary', 'section'])

export const repoDocsFragments = pgTable('repo_docs_fragments', {
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  error: text(),
  fragmentKey: text('fragment_key').notNull(),
  fragmentType: repoDocsFragmentTypeEnum('fragment_type').$type<RepoDocsFragmentType>().notNull(),
  generatedAt: timestamp('generated_at', { mode: 'string' }),
  id: serial().primaryKey().notNull(),
  markdown: text(),
  moduleKey: text('module_key').notNull(),
  modulePath: text('module_path'),
  moduleTitle: text('module_title').notNull(),
  repoId: integer('repo_id').notNull(),
  sectionKey: text('section_key').$type<RepoDocsSectionKey>(),
  sectionTitle: text('section_title'),
  status: repoDocsStatusEnum('status').default('pending').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow()
}, table => [
  index('idx_repo_docs_fragments_repo_id').using('btree', table.repoId.asc().nullsLast().op('int4_ops')),
  index('idx_repo_docs_fragments_repo_module').using('btree', table.repoId.asc().nullsLast().op('int4_ops'), table.moduleKey.asc().nullsLast().op('text_ops')),
  unique('uq_repo_docs_fragments_scope').on(table.repoId, table.moduleKey, table.fragmentType, table.fragmentKey),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'repo_docs_fragments_repo_id_fkey'
  }).onDelete('cascade')
])

export const repoDocsFragmentsRelations = relations(repoDocsFragments, ({ one }) => ({
  repo: one(repos, {
    fields: [repoDocsFragments.repoId],
    references: [repos.id]
  })
}))

export type SelectRepoDocsFragment = InferSelectModel<typeof repoDocsFragments>
export type InsertRepoDocsFragment = InferInsertModel<typeof repoDocsFragments>
