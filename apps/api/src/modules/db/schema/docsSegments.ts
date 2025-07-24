import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm'
import { foreignKey, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

import { files } from './index'

export const docsSegments = pgTable('docs_segments', {
  id: serial().primaryKey().notNull(),
  fileId: integer('file_id').notNull(),
  kind: text().notNull(),
  name: text(),
  content: text().notNull(),
  comment: text(),
  decorators: text().array(),
  params: text().array(),
  returnType: text('return_type'),
  jsDoc: text('js_doc'),
  startLine: integer('start_line'),
  endLine: integer('end_line'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
}, table => [
  foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'docs_segments_file_id_fkey',
  }).onDelete('cascade'),
])

export const docsSegmentsRelations = relations(docsSegments, ({ one }) => ({
  file: one(files, {
    fields: [docsSegments.fileId],
    references: [files.id],
  }),
}))

export type SelectDocsSegment = InferSelectModel<typeof docsSegments>
export type InsertDocsSegment = InferInsertModel<typeof docsSegments>
