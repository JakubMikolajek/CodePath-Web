import { relations } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { chatHistory, chatSessions, repos } from './index'

export const users = pgTable('users', {
  id: serial().primaryKey().notNull(),
  email: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  login: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
}, table => [
  unique('users_email_key').on(table.email),
])

export const usersRelations = relations(users, ({ many }) => ({
  chatHistories: many(chatHistory),
  repos: many(repos),
  chatSessions: many(chatSessions),
}))
