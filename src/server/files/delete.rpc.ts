import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { count, eq } from 'drizzle-orm'
import * as z from 'zod'
import { getSession, isAdmin } from '@/server/auth/session'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import type { Transaction } from '@/server/db/utils'
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

    const blobSha256ToRemove = await deleteFileRecord(input.id, session.user)

    if (blobSha256ToRemove) {
      await removeUnreferencedBlob(blobSha256ToRemove)
    }

    return { deleted: true }
  })

async function deleteFileRecord(
  id: string,
  user: { id: string; role?: string | null },
): Promise<string | undefined> {
  return db.transaction(async (tx) => {
    const initialFile = await tx
      .select({ blobSha256: file.blobSha256 })
      .from(file)
      .where(eq(file.id, id))
      .then(takeUniqueOrNull)

    if (!initialFile) throw new ORPCError('NOT_FOUND')

    await lockBlob(tx, initialFile.blobSha256)
    await ensureCanDeleteFile(tx, id, user)

    const [deletedFile] = await tx
      .delete(file)
      .where(eq(file.id, id))
      .returning({ blobSha256: file.blobSha256 })

    if (!deletedFile) throw new ORPCError('NOT_FOUND')
    return deleteBlobRecordIfUnreferenced(tx, deletedFile.blobSha256)
  })
}

async function ensureCanDeleteFile(
  tx: Transaction,
  id: string,
  user: { id: string; role?: string | null },
) {
  const existingFile = await tx
    .select({ ownerId: file.ownerId })
    .from(file)
    .where(eq(file.id, id))
    .then(takeUniqueOrNull)

  if (!existingFile) throw new ORPCError('NOT_FOUND')
  if (existingFile.ownerId !== user.id && !isAdmin(user.role)) {
    throw new ORPCError('FORBIDDEN')
  }
}

async function deleteBlobRecordIfUnreferenced(tx: Transaction, sha256: string) {
  const [remainingFiles] = await tx
    .select({ count: count() })
    .from(file)
    .where(eq(file.blobSha256, sha256))

  if (remainingFiles.count > 0) return undefined

  await tx.delete(blob).where(eq(blob.sha256, sha256))
  return sha256
}

async function removeUnreferencedBlob(sha256: string) {
  await db.transaction(async (tx) => {
    await lockBlob(tx, sha256)

    // An upload may have recreated this blob after the deletion transaction committed.
    const recreatedBlob = await tx
      .select({ sha256: blob.sha256 })
      .from(blob)
      .where(eq(blob.sha256, sha256))
      .then(takeUniqueOrNull)

    if (!recreatedBlob) {
      await storage.remove(`blobs/${sha256}`)
    }
  })
}
