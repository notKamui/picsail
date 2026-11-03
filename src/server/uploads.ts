import { createHash, randomBytes } from 'node:crypto'
import { encode } from 'blurhash'
import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { env } from '@/lib/env/server'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const extensionByMime = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
} as const

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

export type FileInfoInput = {
  hash: string
}

export type FileInfoResult = {
  hash: string
  type: string
  mime: string
  size: number
  extension: string
  originalName: string | null
  createdAt: Date | null
}

export class UnsupportedUploadTypeError extends Error {}

export class UploadTooLargeError extends Error {}

export class FileNotFoundError extends Error {}

export async function uploadImage({
  userId,
  file: uploadedFile,
}: UploadImageInput): Promise<UploadImageResult> {
  const mimeType = normalizeMime(uploadedFile.type)

  if (!allowedMimeTypes.has(mimeType)) {
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
        url: `${env.BASE_URL}${existing[0].id}.${existing[0].extension}`,
        deleteCode: existing[0].deleteCode,
        sha256,
        size: storedBytes.byteLength,
      } satisfies UploadImageResult
    }

    const extension = extensionByMime[mimeType as keyof typeof extensionByMime]
    const deleteCode = randomBytes(12).toString('hex')
    let id = randomBytes(6).toString('hex')

    while (true) {
      const current = await tx.select().from(file).where(eq(file.id, id)).limit(1)
      if (current.length === 0) break
      id = randomBytes(6).toString('hex')
    }

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

    const created = await tx
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
      id: created[0].id,
      url: `${env.BASE_URL}${created[0].id}.${created[0].extension}`,
      deleteCode: created[0].deleteCode,
      sha256,
      size: storedBytes.byteLength,
    } satisfies UploadImageResult
  })

  await storage.put(`blobs/${sha256}`, storedBytes, mimeType)

  return result
}

export async function getFileInfo({ hash }: FileInfoInput): Promise<FileInfoResult> {
  const chosenFile = await db
    .select({
      id: file.id,
      kind: file.kind,
      extension: file.extension,
      originalName: file.originalName,
      createdAt: file.createdAt,
      byteSize: blob.byteSize,
      mime: blob.mime,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.id, hash))
    .limit(1)

  if (!chosenFile[0]) {
    throw new FileNotFoundError('File not found')
  }

  const row = chosenFile[0]

  return {
    hash: row.id,
    type: row.kind,
    mime: row.mime,
    size: Number(row.byteSize),
    extension: row.extension,
    originalName: row.originalName,
    createdAt: row.createdAt,
  }
}

async function prepareStoredImageBytes(sourceBytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/gif') {
    return sourceBytes
  }

  const outputFormat =
    mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpeg'
  return Buffer.from(
    await sharp(Buffer.from(sourceBytes))
      .rotate()
      .toFormat(outputFormat, {
        quality: 92,
        compressionLevel: 9,
      })
      .toBuffer(),
  )
}

async function calculateBlurhash(imageBytes: Uint8Array) {
  const { data, info } = await sharp(Buffer.from(imageBytes))
    .rotate()
    .resize(32, 32, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4)
}

function normalizeMime(mimeType: string) {
  return mimeType.toLowerCase().split(';', 1)[0] || 'application/octet-stream'
}
