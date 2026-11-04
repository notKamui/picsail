import { os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { tryAsync } from '@/lib/try'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'

export type FileInfoInput = {
  hash: string
}

export type FileInfoResult = {
  hash: string
  type: string
  mime: string
  size: number
  blurhash: string | null
  extension: string
  originalName: string | null
  createdAt: Date | null
}

export class FileNotFoundError extends Error {}

export const getTestFile = os
  .route({
    method: 'GET',
    path: '/files/{id}',
    summary: 'Get file metadata',
    tags: ['Files'],
  })
  .input(z.object({ id: z.string().regex(/^[a-f0-9]{12}$/i) }))
  .handler(async ({ input }) => {
    const [error, info] = await tryAsync(getFileInfo({ hash: input.id }), [FileNotFoundError])
    return error ? null : info
  })

export async function getFileInfo({ hash }: FileInfoInput): Promise<FileInfoResult> {
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
    .where(eq(file.id, hash))
    .limit(1)

  if (!chosenFile) {
    throw new FileNotFoundError('File not found')
  }

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
}
