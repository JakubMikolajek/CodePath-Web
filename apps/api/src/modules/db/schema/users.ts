import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { apiRunnerCollections, chatHistory, chatSessions, repos } from './index'

export const users = pgTable('users', {
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  email: text().notNull(),
  id: serial().primaryKey().notNull(),
  login: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow()
}, table => [
  unique('users_email_key').on(table.email)
])

export const usersRelations = relations(users, ({ many }) => ({
  apiRunnerCollections: many(apiRunnerCollections),
  chatHistories: many(chatHistory),
  chatSessions: many(chatSessions),
  repos: many(repos)
}))

export type SelectUser = InferSelectModel<typeof users>
export type InserUser = InferInsertModel<typeof users>
