import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { evaluationMetrics, repos } from './index'

export const evaluationRunTypeEnum = pgEnum('evaluation_run_type', ['docs_quality', 'retrieval', 'chat_faithfulness', 'full'])
export const evaluationRunStatusEnum = pgEnum('evaluation_run_status', ['pending', 'running', 'completed', 'failed'])

export const evaluationRuns = pgTable('evaluation_runs', {
  completedAt: timestamp('completed_at', { mode: 'string' }),
  errorMessage: text('error_message'),
  id: serial().primaryKey().notNull(),
  repoId: integer('repo_id').notNull(),
  runType: evaluationRunTypeEnum('run_type').notNull(),
  status: evaluationRunStatusEnum('status').default('pending').notNull(),
  triggeredAt: timestamp('triggered_at', { mode: 'string' }).defaultNow().notNull()
}, table => [
  index('idx_evaluation_runs_repo_id').using('btree', table.repoId.asc().nullsLast().op('int4_ops')),
  foreignKey({
    columns: [table.repoId],
    foreignColumns: [repos.id],
    name: 'evaluation_runs_repo_id_fkey'
  }).onDelete('cascade')
])

export const evaluationRunsRelations = relations(evaluationRuns, ({ many, one }) => ({
  metrics: many(evaluationMetrics),
  repo: one(repos, {
    fields: [evaluationRuns.repoId],
    references: [repos.id]
  })
}))

export type SelectEvaluationRun = InferSelectModel<typeof evaluationRuns>
export type InsertEvaluationRun = InferInsertModel<typeof evaluationRuns>
