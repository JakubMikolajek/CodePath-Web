import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { doublePrecision, foreignKey, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { evaluationRuns } from './index'

export const evaluationMetrics = pgTable('evaluation_metrics', {
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  id: serial().primaryKey().notNull(),
  metricName: text('metric_name').notNull(),
  metricValue: doublePrecision('metric_value').notNull(),
  runId: integer('run_id').notNull(),
  targetRef: text('target_ref')
}, table => [
  index('idx_evaluation_metrics_run_id').using('btree', table.runId.asc().nullsLast().op('int4_ops')),
  foreignKey({
    columns: [table.runId],
    foreignColumns: [evaluationRuns.id],
    name: 'evaluation_metrics_run_id_fkey'
  }).onDelete('cascade')
])

export const evaluationMetricsRelations = relations(evaluationMetrics, ({ one }) => ({
  run: one(evaluationRuns, {
    fields: [evaluationMetrics.runId],
    references: [evaluationRuns.id]
  })
}))

export type SelectEvaluationMetric = InferSelectModel<typeof evaluationMetrics>
export type InsertEvaluationMetric = InferInsertModel<typeof evaluationMetrics>
