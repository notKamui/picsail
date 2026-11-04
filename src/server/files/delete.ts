import { openapi } from '@orpc/openapi'
import { os } from '@orpc/server'
import { and, count, eq } from 'drizzle-orm'
import * as z from 'zod'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'

export const deleteFileByCode = os
  .meta(
    openapi({
      method: 'DELETE',
      path: '/files/{id}',
      summary: 'Delete a file using its delete code',
      tags: ['Files'],
    }),
  )
  .input(
    z.object({
      id: z
        .string()
        .toLowerCase()
        .regex(/^[a-f0-9]{12}$/),
      deleteCode: z
        .string()
        .toLowerCase()
        .regex(/^[a-f0-9]{24}$/),
    }),
  )
  .handler(async ({ input }) => {
    const result = await db.transaction(async (tx) => {
      const [deletedFile] = await tx
        .delete(file)
        .where(and(eq(file.id, input.id), eq(file.deleteCode, input.deleteCode)))
        .returning({ blobSha256: file.blobSha256 })

      if (!deletedFile) return { deleted: false as const }

      const [remainingFiles] = await tx
        .select({ count: count() })
        .from(file)
        .where(eq(file.blobSha256, deletedFile.blobSha256))

      if (remainingFiles.count > 0) return { deleted: true as const }

      await tx.delete(blob).where(eq(blob.sha256, deletedFile.blobSha256))
      return { deleted: true as const, blobSha256: deletedFile.blobSha256 }
    })

    if (result.blobSha256) {
      await storage.delete(`blobs/${result.blobSha256}`)
    }

    return { deleted: result.deleted }
  })
