import { openapi } from '@orpc/openapi'
import { os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'

export const getFileMetadata = os
  .meta(
    openapi({
      method: 'GET',
      path: '/files/{id}',
      summary: 'Get file metadata',
      tags: ['Files'],
    }),
  )
  .input(z.object({ id: z.string().regex(/^[a-f0-9]{12}$/i) }))
  .handler(async ({ input }) => {
    const [chosenFile] = await db
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
      .where(eq(file.id, input.id))
      .limit(1)

    if (!chosenFile) return null

    return {
      hash: chosenFile.id,
      type: chosenFile.kind,
      mime: chosenFile.mime,
      size: Number(chosenFile.byteSize),
      blurhash: chosenFile.blurhash,
      extension: chosenFile.extension,
      originalName: chosenFile.originalName,
      createdAt: chosenFile.createdAt,
    }
  })
