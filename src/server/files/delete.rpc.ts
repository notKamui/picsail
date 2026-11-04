import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { count, eq } from 'drizzle-orm'
import * as z from 'zod'
import { getSession, isAdmin } from '@/server/auth/session'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import { lockBlob } from './blob-lock'

export default os
  .meta(
    openapi({
      method: 'DELETE',
      path: '/files/{id}',
      summary: 'Delete a file owned by the current user or an admin',
      tags: ['Files'],
    }),
  )
  .input(
    z.object({
      id: z
        .string()
        .toLowerCase()
        .regex(/^[a-f0-9]{12}$/),
    }),
  )
  .handler(async ({ input }) => {
    const session = await getSession()
    if (!session?.user) throw new ORPCError('UNAUTHORIZED')

    const blobSha256ToRemove = await db.transaction(async (tx) => {
      const [initialFile] = await tx
        .select({ blobSha256: file.blobSha256 })
        .from(file)
        .where(eq(file.id, input.id))
        .limit(1)

      if (!initialFile) throw new ORPCError('NOT_FOUND')

      await lockBlob(tx, initialFile.blobSha256)

      const [existingFile] = await tx
        .select({ ownerId: file.ownerId, blobSha256: file.blobSha256 })
        .from(file)
        .where(eq(file.id, input.id))
        .limit(1)

      if (!existingFile) throw new ORPCError('NOT_FOUND')
      if (existingFile.ownerId !== session.user.id && !isAdmin(session.user.role)) {
        throw new ORPCError('FORBIDDEN')
      }

      const [deletedFile] = await tx
        .delete(file)
        .where(eq(file.id, input.id))
        .returning({ blobSha256: file.blobSha256 })

      if (!deletedFile) throw new ORPCError('NOT_FOUND')

      const [remainingFiles] = await tx
        .select({ count: count() })
        .from(file)
        .where(eq(file.blobSha256, deletedFile.blobSha256))

      if (remainingFiles.count > 0) return undefined

      await tx.delete(blob).where(eq(blob.sha256, deletedFile.blobSha256))
      return deletedFile.blobSha256
    })

    if (blobSha256ToRemove) {
      await db.transaction(async (tx) => {
        await lockBlob(tx, blobSha256ToRemove)

        // An upload may have recreated this blob after the deletion transaction committed.
        const [recreatedBlob] = await tx
          .select({ sha256: blob.sha256 })
          .from(blob)
          .where(eq(blob.sha256, blobSha256ToRemove))
          .limit(1)

        if (!recreatedBlob) {
          await storage.remove(`blobs/${blobSha256ToRemove}`)
        }
      })
    }

    return { deleted: true }
  })
