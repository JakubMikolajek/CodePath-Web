import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { chatHistory, repos, users } from './index'

export const chatSessions = pgTable('chat_sessions', {
  id: text().primaryKey().notNull(),
  userId: integer('user_id').notNull(),
  repoId: integer('repo_id').notNull(),
  name: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, table => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'chat_sessions_user_id_fkey',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'chat_sessions_repo_id_fkey',
  }).onDelete('cascade'),
])

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  chatHistories: many(chatHistory),
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  repo: one(repos, {
    fields: [chatSessions.repoId],
    references: [repos.id],
  }),
}))
