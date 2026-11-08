import { createHash, randomBytes } from 'node:crypto'
import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { publicFileUrl } from '@/lib/public-file-url'
import { tryAsync } from '@/lib/try'
import { getSession } from '@/server/auth/session'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import type { Transaction } from '@/server/db/utils'
import { storage } from '@/server/storage'
import { lockBlob } from './blob-lock'
import {
  calculateBlurhash,
  imageExtension,
  InvalidImageUploadError,
  isSupportedImageMime,
  normalizeMime,
  prepareStoredImageBytes,
  type SupportedImageMime,
} from './image-processing'

type UploadValidation =
  | { status: 'invalid-file' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }
  | { status: 'ok'; ownerId: string; mimeType: SupportedImageMime }

export default os
  .meta(
    openapi({
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
    }),
  )
  .input(z.object({ file: z.file() }))
  .handler(async ({ input }) => {
    const validation = await validateUpload(input.file)
    if (validation.status !== 'ok') return validation

    const [imageError, prepared] = await tryAsync(
      prepareImageUpload(input.file, validation.mimeType),
      [InvalidImageUploadError],
    )
    if (imageError) {
      throw new ORPCError('BAD_REQUEST', { message: imageError.message })
    }

    const storedFile = await persistUploadedFile({
      ownerId: validation.ownerId,
      originalName: input.file.name,
      mimeType: validation.mimeType,
      ...prepared,
    })

    return {
      status: 'ok' as const,
      hash: storedFile.id,
      url: publicFileUrl(storedFile.id, storedFile.extension, env.BASE_URL),
      size: prepared.storedBytes.byteLength,
    }
  })

/**
 * Checks the upload before reading or decoding its bytes, including the current
 * request's session, declared MIME type and configured size limit.
 * @param uploadedFile - File received by the multipart upload procedure.
 * @returns A failure status or the authenticated owner and supported MIME type.
 */
async function validateUpload(uploadedFile: File): Promise<UploadValidation> {
  if (uploadedFile.size === 0) {
    return { status: 'invalid-file' as const }
  }

  const session = await getSession()
  if (!session?.user) {
    return { status: 'unauthorized' as const }
  }

  const mimeType = normalizeMime(uploadedFile.type)
  if (!isSupportedImageMime(mimeType)) {
    return {
      status: 'error' as const,
      message: 'Only JPEG, PNG, GIF, and WebP uploads are supported',
    }
  }

  if (uploadedFile.size > env.MAX_UPLOAD_BYTES) {
    return {
      status: 'error' as const,
      message: `Upload exceeds the ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`,
    }
  }

  return {
    status: 'ok' as const,
    ownerId: session.user.id,
    mimeType,
  }
}

/**
 * Reads, normalizes and fingerprints an upload before opening a database
 * transaction; processing and decoding failures propagate.
 * @param uploadedFile - Validated multipart file to read into memory.
 * @param mimeType - Validated MIME type used for re-encoding.
 * @returns Stored bytes, their SHA-256 hash and a BlurHash placeholder.
 */
async function prepareImageUpload(uploadedFile: File, mimeType: SupportedImageMime) {
  const sourceBytes = new Uint8Array(await uploadedFile.arrayBuffer())
  const storedBytes = await prepareStoredImageBytes(sourceBytes, mimeType)
  const sha256 = createHash('sha256').update(storedBytes).digest('hex')
  const blurhash = await calculateBlurhash(storedBytes)

  return { storedBytes, sha256, blurhash }
}

/**
 * Persists an upload under the blob lock, reusing an existing owner/file pair.
 * S3 bytes are written before database references; a later SQL failure cannot
 * roll back the S3 write and may leave an unreferenced object.
 * @param options - Owner, original name, MIME type and prepared bytes/hash/BlurHash.
 * @returns The existing or newly created file's public ID and extension.
 */
async function persistUploadedFile({
  ownerId,
  originalName,
  mimeType,
  storedBytes,
  sha256,
  blurhash,
}: {
  ownerId: string
  originalName: string
  mimeType: SupportedImageMime
  storedBytes: Uint8Array
  sha256: string
  blurhash: string
}) {
  return db.transaction(async (tx) => {
    await lockBlob(tx, sha256)

    const existingFile = await tx
      .select({ id: file.id, extension: file.extension })
      .from(file)
      .where(and(eq(file.ownerId, ownerId), eq(file.blobSha256, sha256)))
      .then(takeUniqueOrNull)

    if (existingFile) {
      await storage.put(`blobs/${sha256}`, storedBytes, mimeType)
      return existingFile
    }

    const id = await generateFileId(tx)
    const extension = imageExtension(mimeType)

    await storage.put(`blobs/${sha256}`, storedBytes, mimeType)
    await tx
      .insert(blob)
      .values({
        sha256,
        byteSize: storedBytes.byteLength,
        mime: mimeType,
        blurhash,
      })
      .onConflictDoNothing()

    const [createdFile] = await tx
      .insert(file)
      .values({
        id,
        ownerId,
        blobSha256: sha256,
        extension,
        kind: 'image',
        originalName: originalName || null,
      })
      .returning({ id: file.id, extension: file.extension })

    return createdFile
  })
}

/**
 * Generates an upload's short random public ID, retrying IDs found in the database.
 * The subsequent insert is responsible for enforcing uniqueness under concurrency.
 * @param tx - Upload transaction used to check candidate IDs.
 * @returns A currently unused 12-character hexadecimal ID.
 */
async function generateFileId(tx: Transaction) {
  while (true) {
    const id = randomBytes(6).toString('hex')
    const existingFile = await tx
      .select({ id: file.id })
      .from(file)
      .where(eq(file.id, id))
      .then(takeUniqueOrNull)

    if (!existingFile) return id
  }
}
