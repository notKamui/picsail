import { createHash, randomBytes } from 'node:crypto'
import { os } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { tryAsync } from '@/lib/try'
import { getSession } from '@/server/auth/session'
import { db, type Transaction } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import {
  calculateBlurhash,
  imageExtension,
  isSupportedImageMime,
  normalizeMime,
  prepareStoredImageBytes,
} from './image-processing'

export type UploadImageInput = {
  userId: string
  file: File
}

export type UploadImageResult = {
  id: string
  url: string
  deleteCode: string
  sha256: string
  size: number
}

export class UnsupportedUploadTypeError extends Error {}

export class UploadTooLargeError extends Error {}

export const uploadImageForUser = os
  .route({
    method: 'POST',
    path: '/files/upload',
    summary: 'Upload an image',
    tags: ['Files'],
    spec: (operation) => ({
      ...operation,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
              },
              required: ['file'],
            },
          },
        },
      },
    }),
  })
  .input(z.object({ file: z.file() }))
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

export async function uploadImage({
  userId,
  file: uploadedFile,
}: UploadImageInput): Promise<UploadImageResult> {
  const mimeType = normalizeMime(uploadedFile.type)

  if (!isSupportedImageMime(mimeType)) {
    throw new UnsupportedUploadTypeError('Only JPEG, PNG, GIF, and WebP uploads are supported')
  }

  if (uploadedFile.size > env.MAX_UPLOAD_BYTES) {
    throw new UploadTooLargeError(
      `Upload exceeds the ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`,
    )
  }

  const sourceBytes = new Uint8Array(await uploadedFile.arrayBuffer())
  const storedBytes = await prepareStoredImageBytes(sourceBytes, mimeType)
  const sha256 = createHash('sha256').update(storedBytes).digest('hex')

  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(file)
      .where(and(eq(file.ownerId, userId), eq(file.blobSha256, sha256)))
      .limit(1)

    if (existing[0]) {
      return {
        id: existing[0].id,
        url: getPublicUrl(existing[0].id, existing[0].extension),
        deleteCode: existing[0].deleteCode,
        sha256,
        size: storedBytes.byteLength,
      } satisfies UploadImageResult
    }

    const id = await generateUniqueFileId(tx)
    const extension = imageExtension(mimeType)
    const deleteCode = randomBytes(12).toString('hex')
    const blurhash = await calculateBlurhash(storedBytes)

    await tx
      .insert(blob)
      .values({
        sha256,
        byteSize: storedBytes.byteLength,
        mime: mimeType,
        blurhash,
      })
      .onConflictDoNothing()

    const [created] = await tx
      .insert(file)
      .values({
        id,
        ownerId: userId,
        blobSha256: sha256,
        extension,
        kind: 'image',
        deleteCode,
        originalName: uploadedFile.name || null,
      })
      .returning()

    return {
      id: created.id,
      url: getPublicUrl(created.id, created.extension),
      deleteCode: created.deleteCode,
      sha256,
      size: storedBytes.byteLength,
    } satisfies UploadImageResult
  })

  await storage.put(`blobs/${sha256}`, storedBytes, mimeType)

  return result
}

async function generateUniqueFileId(tx: Transaction) {
  while (true) {
    const id = randomBytes(6).toString('hex')
    const current = await tx.select({ id: file.id }).from(file).where(eq(file.id, id)).limit(1)
    if (current.length === 0) return id
  }
}

function getPublicUrl(id: string, extension: string) {
  return new URL(`f/${id}.${extension}`, env.BASE_URL).toString()
}
