import { relations } from 'drizzle-orm'
import { bigint, index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { user } from '@/server/db/schema/auth'

export const blob = pgTable('blob', {
  sha256: text('sha256').primaryKey(),
  byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
  mime: text('mime').notNull(),
  blurhash: text('blurhash'),
})

export const file = pgTable(
  'file',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blobSha256: text('blob_sha256')
      .notNull()
      .references(() => blob.sha256),
    extension: text('extension').notNull(),
    kind: text('kind').notNull(),
    deleteCode: text('delete_code').notNull(),
    originalName: text('original_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('file_owner_blob_unique').on(table.ownerId, table.blobSha256),
    index('file_ownerId_idx').on(table.ownerId),
  ],
)

export const blobRelations = relations(blob, ({ many }) => ({
  files: many(file),
}))

export const fileRelations = relations(file, ({ one }) => ({
  owner: one(user, {
    fields: [file.ownerId],
    references: [user.id],
  }),
  blob: one(blob, {
    fields: [file.blobSha256],
    references: [blob.sha256],
  }),
}))
