import type { RepoApiRunnerCollectionConfig } from '@workspace/codepath-common/api-explorer'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { repos, users } from './index'

export const apiRunnerCollections = pgTable('api_runner_collections', {
  config: jsonb('config').$type<RepoApiRunnerCollectionConfig>().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  id: serial().primaryKey().notNull(),
  name: text('name').notNull(),
  repoId: integer('repo_id').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  userId: integer('user_id').notNull()
}, table => [
  unique('api_runner_collections_repo_user_name_key').on(table.repoId, table.userId, table.name),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'api_runner_collections_repo_id_fkey'
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'api_runner_collections_user_id_fkey'
  }).onDelete('cascade')
])

export const apiRunnerCollectionsRelations = relations(apiRunnerCollections, ({ one }) => ({
  repo: one(repos, {
    fields: [apiRunnerCollections.repoId],
    references: [repos.id]
  }),
  user: one(users, {
    fields: [apiRunnerCollections.userId],
    references: [users.id]
  })
}))

export type SelectApiRunnerCollection = InferSelectModel<typeof apiRunnerCollections>
export type InsertApiRunnerCollection = InferInsertModel<typeof apiRunnerCollections>
