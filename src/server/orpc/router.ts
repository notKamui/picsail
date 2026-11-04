import { os } from '@orpc/server'
import { desc, eq } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { tryAsync } from '@/lib/try'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { deleteFile, FileNotFoundOrDeleteCodeMismatchError } from '@/server/files/delete'
import { FileNotFoundError, getFileInfo } from '@/server/files/info'
import { uploadImage, UnsupportedUploadTypeError, UploadTooLargeError } from '@/server/files/upload'

const listOwnedFiles = os.handler(async () => {
  const session = await getSession()
  if (!session?.user) {
    return { authenticated: false as const, files: [] }
  }

  const rows = await db
    .select({
      id: file.id,
      extension: file.extension,
      mime: blob.mime,
      byteSize: blob.byteSize,
      originalName: file.originalName,
      createdAt: file.createdAt,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.ownerId, session.user.id))
    .orderBy(desc(file.createdAt))
    .limit(100)

  return {
    authenticated: true as const,
    files: rows.map((row) => ({
      ...row,
      size: Number(row.byteSize),
      publicUrl: new URL(`f/${row.id}.${row.extension}`, env.BASE_URL).toString(),
    })),
  }
})

const getTestFile = os
  .input(z.object({ id: z.string().regex(/^[a-f0-9]{12}$/i) }))
  .handler(async ({ input }) => {
    const [error, info] = await tryAsync(getFileInfo({ hash: input.id }), [FileNotFoundError])
    return error ? null : info
  })

const deleteFileByCode = os
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
    const [error] = await tryAsync(deleteFile(input), [FileNotFoundOrDeleteCodeMismatchError])
    if (error) return { deleted: false as const }
    return { deleted: true as const }
  })

const uploadImageForUser = os
  .input(z.object({ file: z.custom<File>((value) => value instanceof File) }))
  .handler(async ({ input }) => {
    const uploadedFile = input.file
    if (uploadedFile.size === 0) {
      return { status: 'invalid-file' as const }
    }

    const session = await getSession()
    if (!session?.user) {
      return { status: 'unauthorized' as const }
    }

    const [error, upload] = await tryAsync(
      uploadImage({ userId: session.user.id, file: uploadedFile }),
      [UnsupportedUploadTypeError, UploadTooLargeError],
    )
    if (error) {
      return { status: 'error' as const, message: error.message }
    }

    return { status: 'success' as const, upload }
  })

export const router = {
  files: {
    listOwned: listOwnedFiles,
    getTest: getTestFile,
    deleteByCode: deleteFileByCode,
    uploadImage: uploadImageForUser,
  },
}
