import { and, count, eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'

export type DeleteFileInput = {
  id: string
  deleteCode: string
}

export class FileNotFoundOrDeleteCodeMismatchError extends Error {}

export async function deleteFile({ id, deleteCode }: DeleteFileInput) {
  const blobToDelete = await db.transaction(async (tx) => {
    const [deletedFile] = await tx
      .delete(file)
      .where(and(eq(file.id, id), eq(file.deleteCode, deleteCode)))
      .returning({ blobSha256: file.blobSha256 })

    if (!deletedFile) {
      throw new FileNotFoundOrDeleteCodeMismatchError('File not found or delete code is invalid')
    }

    const [remainingFiles] = await tx
      .select({ count: count() })
      .from(file)
      .where(eq(file.blobSha256, deletedFile.blobSha256))

    if (remainingFiles.count > 0) return null

    await tx.delete(blob).where(eq(blob.sha256, deletedFile.blobSha256))
    return deletedFile.blobSha256
  })

  if (blobToDelete) {
    await storage.delete(`blobs/${blobToDelete}`)
  }
}
