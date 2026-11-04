import { createHash, randomBytes } from 'node:crypto'
import { os } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import {
  calculateBlurhash,
  imageExtension,
  isSupportedImageMime,
  normalizeMime,
  prepareStoredImageBytes,
} from './image-processing'

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

    const sourceBytes = new Uint8Array(await uploadedFile.arrayBuffer())
    const storedBytes = await prepareStoredImageBytes(sourceBytes, mimeType)
    const sha256 = createHash('sha256').update(storedBytes).digest('hex')

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(file)
        .where(and(eq(file.ownerId, session.user.id), eq(file.blobSha256, sha256)))
        .limit(1)

      if (existing[0]) {
        return {
          id: existing[0].id,
          url: new URL(`f/${existing[0].id}.${existing[0].extension}`, env.BASE_URL).toString(),
          deleteCode: existing[0].deleteCode,
          sha256,
          size: storedBytes.byteLength,
        }
      }

      let id: string
      while (true) {
        id = randomBytes(6).toString('hex')
        const current = await tx.select({ id: file.id }).from(file).where(eq(file.id, id)).limit(1)
        if (current.length === 0) break
      }

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
          ownerId: session.user.id,
          blobSha256: sha256,
          extension,
          kind: 'image',
          deleteCode,
          originalName: uploadedFile.name || null,
        })
        .returning()

      return {
        id: created.id,
        url: new URL(`f/${created.id}.${created.extension}`, env.BASE_URL).toString(),
        deleteCode: created.deleteCode,
        sha256,
        size: storedBytes.byteLength,
      }
    })

    await storage.put(`blobs/${sha256}`, storedBytes, mimeType)

    return { status: 'success' as const, upload: result }
  })
