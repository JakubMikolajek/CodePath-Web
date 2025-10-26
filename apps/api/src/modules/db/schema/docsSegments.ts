import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { files } from './index'

export const docsSegments = pgTable('docs_segments', {
  comment: text(),
  content: text().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  decorators: text().array(),
  endLine: integer('end_line'),
  fileId: integer('file_id').notNull(),
  id: serial().primaryKey().notNull(),
  jsDoc: text('js_doc'),
  kind: text().notNull(),
  name: text(),
  params: text().array(),
  returnType: text('return_type'),
  startLine: integer('start_line')
}, table => [
  foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'docs_segments_file_id_fkey'
  }).onDelete('cascade')
])

export const docsSegmentsRelations = relations(docsSegments, ({ one }) => ({
  file: one(files, {
    fields: [docsSegments.fileId],
    references: [files.id]
  })
}))

export type SelectDocsSegment = InferSelectModel<typeof docsSegments>
export type InsertDocsSegment = InferInsertModel<typeof docsSegments>
