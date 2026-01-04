import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { chatSessions, dependencies, files, users } from './index'

export const repos = pgTable('repos', {
  accessKey: text('access_key'),
  cloneStatus: text('clone_status').default('pending'),
  embeddingStatus: text('embedding_status').default('pending'),
  gitUrl: text('git_url').notNull(),
  id: serial().primaryKey().notNull(),
  indexedAt: timestamp('indexed_at', { mode: 'string' }).defaultNow(),
  name: text().notNull(),
  path: text(),
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
