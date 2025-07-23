import { relations, sql } from 'drizzle-orm'
import { check, foreignKey, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { chatSessions, users } from './index'

export const chatHistory = pgTable('chat_history', {
  id: serial().primaryKey().notNull(),
  userId: integer('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  role: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, table => [
  index('idx_chat_history_created_at').using('btree', table.createdAt.asc().nullsLast().op('timestamp_ops')),
  index('idx_chat_history_user_session').using('btree', table.userId.asc().nullsLast().op('text_ops'), table.sessionId.asc().nullsLast().op('int4_ops'), table.createdAt.asc().nullsLast().op('text_ops')),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: 'chat_history_user_id_fkey',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [chatSessions.id],
    name: 'chat_history_session_id_fkey',
  }).onDelete('cascade'),
  check('chat_history_role_check', sql`role = ANY (ARRAY['user'::text, 'assistant'::text])`),
])

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  user: one(users, {
    fields: [chatHistory.userId],
    references: [users.id],
  }),
  chatSession: one(chatSessions, {
    fields: [chatHistory.sessionId],
    references: [chatSessions.id],
  }),
}))
