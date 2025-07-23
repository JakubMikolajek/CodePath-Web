import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, pgTable, serial, text, vector } from 'drizzle-orm/pg-core'

import { files } from './index'

export const embeddings = pgTable('embeddings', {
  id: serial().primaryKey().notNull(),
  fileId: integer('file_id').notNull(),
  content: text().notNull(),
  embedding: vector({ dimensions: 384 }),
  symbolKind: text('symbol_kind').default('fragment').notNull(),
  symbolName: text('symbol_name'),
}, table => [
  index('idx_embeddings_vector').using('ivfflat', table.embedding.asc().nullsLast().op('vector_cosine_ops')).with({ lists: '100' }),
  foreignKey({
    columns: [table.fileId],
    foreignColumns: [files.id],
    name: 'embeddings_file_id_fkey',
  }).onDelete('cascade'),
])

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  file: one(files, {
    fields: [embeddings.fileId],
    references: [files.id],
  }),
}))
