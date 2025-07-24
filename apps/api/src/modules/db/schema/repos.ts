import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { chatSessions, dependencies, files, users } from './index'

export const repos = pgTable('repos', {
  id: serial().primaryKey().notNull(),
  userId: integer('user_id').notNull(),
  name: text().notNull(),
  path: text(),
  gitUrl: text('git_url').notNull(),
  accessKey: text('access_key'),
  cloneStatus: text('clone_status').default('pending'),
  indexedAt: timestamp('indexed_at', { mode: 'string' }).defaultNow(),
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'repos_user_id_fkey',
  }).onDelete('cascade'),
])

export const reposRelations = relations(repos, ({ one, many }) => ({
  user: one(users, {
    fields: [repos.userId],
    references: [users.id],
  }),
  files: many(files),
  chatSessions: many(chatSessions),
  dependencies: many(dependencies),
}))

export type SelectRepo = InferSelectModel<typeof repos>
export type InsertRepo = InferInsertModel<typeof repos>
