import { openapi } from '@orpc/openapi'
import { os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'

export default os
  .meta(
    openapi({
      method: 'GET',
      path: '/files/{id}',
      summary: 'Get file metadata',
      tags: ['Files'],
    }),
  )
  .input(z.object({ id: z.string().regex(/^[a-f0-9]{12}$/i) }))
  .handler(({ input }) => getFileMetadata(input.id))

/**
 * Fetches joined file/blob metadata for the public oRPC metadata procedure.
 * @param id - Public file ID.
 * @returns API metadata with size in bytes, or null when the file is absent.
 */
async function getFileMetadata(id: string) {
  const row = await db
    .select({
      id: file.id,
      kind: file.kind,
      extension: file.extension,
      originalName: file.originalName,
      createdAt: file.createdAt,
      byteSize: blob.byteSize,
      mime: blob.mime,
      blurhash: blob.blurhash,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.id, id))
    .then(takeUniqueOrNull)

  if (!row) return null

  return {
    hash: row.id,
    type: row.kind,
    mime: row.mime,
    size: Number(row.byteSize),
    blurhash: row.blurhash,
    extension: row.extension,
    originalName: row.originalName,
    createdAt: row.createdAt,
  }
}
