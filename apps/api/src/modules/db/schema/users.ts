import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'

import { apiRunnerAuthPresets, apiRunnerCollections, chatHistory, chatSessions, repos } from './index'

export const users = pgTable('users', {
  authProvider: text('auth_provider').default('local').notNull(),
  authSubject: text('auth_subject'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  email: text().notNull(),
  id: serial().primaryKey().notNull(),
  login: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow()
}, table => [
  uniqueIndex('users_auth_provider_subject_key')
    .on(table.authProvider, table.authSubject)
    .where(sql`${table.authSubject} IS NOT NULL`),
  unique('users_email_key').on(table.email)
])

export const usersRelations = relations(users, ({ many }) => ({
  apiRunnerAuthPresets: many(apiRunnerAuthPresets),
  apiRunnerCollections: many(apiRunnerCollections),
  chatHistories: many(chatHistory),
  chatSessions: many(chatSessions),
  repos: many(repos)
}))

export type SelectUser = InferSelectModel<typeof users>
export type InserUser = InferInsertModel<typeof users>
