import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgTable, serial, text, vector } from 'drizzle-orm/pg-core'

import { files } from './index'

export const embeddings = pgTable('embeddings', {
  comment: text('comment'),
  content: text().notNull(),
  decorators: text('decorators').array(),
  embedding: vector({ dimensions: 384 }),
  endLine: integer('end_line'),
  fileId: integer('file_id').notNull(),
  id: serial().primaryKey().notNull(),
  jsDoc: text('js_doc'),
  params: text('params').array(),
  returnType: text('return_type'),
  startLine: integer('start_line'),
  symbolKind: text('symbol_kind').default('fragment').notNull(),
  symbolName: text('symbol_name')
}, table => [
  index('idx_embeddings_vector').using('ivfflat', table.embedding.asc().nullsLast().op('vector_cosine_ops')).with({ lists: '100' }),
  foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'embeddings_file_id_fkey'
  }).onDelete('cascade')
])

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  file: one(files, {
    fields: [embeddings.fileId],
    references: [files.id]
  })
}))

export type SelectEmbedding = InferSelectModel<typeof embeddings>
export type InsertEmbedding = InferInsertModel<typeof embeddings>
