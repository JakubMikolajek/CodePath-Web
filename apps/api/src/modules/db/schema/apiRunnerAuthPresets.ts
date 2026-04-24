import type { RepoApiRunnerAuthConfig } from '@workspace/codepath-common/api-explorer'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { repos, users } from './index'

export const apiRunnerAuthPresets = pgTable('api_runner_auth_presets', {
  config: jsonb('config').$type<RepoApiRunnerAuthConfig>().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  id: serial().primaryKey().notNull(),
  name: text('name').notNull(),
  repoId: integer('repo_id').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  userId: integer('user_id').notNull()
}, table => [
  unique('api_runner_auth_presets_repo_user_name_key').on(table.repoId, table.userId, table.name),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'api_runner_auth_presets_repo_id_fkey'
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'api_runner_auth_presets_user_id_fkey'
  }).onDelete('cascade')
])

export const apiRunnerAuthPresetsRelations = relations(apiRunnerAuthPresets, ({ one }) => ({
  repo: one(repos, {
    fields: [apiRunnerAuthPresets.repoId],
    references: [repos.id]
  }),
  user: one(users, {
    fields: [apiRunnerAuthPresets.userId],
    references: [users.id]
  })
}))

export type SelectApiRunnerAuthPreset = InferSelectModel<typeof apiRunnerAuthPresets>
export type InsertApiRunnerAuthPreset = InferInsertModel<typeof apiRunnerAuthPresets>
