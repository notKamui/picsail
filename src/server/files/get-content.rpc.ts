import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import { lockBlob } from './blob-lock'
import { resizeImageBytes, type ImageDimensions } from './image-processing'

export default os
  .meta(
    openapi({
      method: 'GET',
      path: '/files/{id}/content/{extension}',
      summary: 'Get a public file',
      tags: ['Files'],
      outputStructure: 'detailed',
      spec: (operation) => ({
        ...operation,
        responses: {
          ...operation.responses,
          200: {
            description: 'File content',
            content: {
              'image/jpeg': { schema: { type: 'string', format: 'binary' } },
              'image/png': { schema: { type: 'string', format: 'binary' } },
              'image/gif': { schema: { type: 'string', format: 'binary' } },
              'image/webp': { schema: { type: 'string', format: 'binary' } },
            },
          },
        },
      }),
    }),
  )
  .input(
    z.object({
      id: z.string().regex(/^[a-f0-9]{12}$/i),
      extension: z.string().regex(/^[a-z0-9]+$/i),
    }),
  )
  .output(
    z.object({
      status: z.literal(200),
      headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      body: z.custom<ReadableStream<Uint8Array>>(),
    }),
  )
  .handler(async ({ input }) => getFileContentResponse(input))

export async function getFileContentResponse(input: { id: string; extension: string }) {
  const fileContent = await findFileContent(input.id)
  assertFileExists(fileContent, input.extension)

  const object = await storage.open(`blobs/${fileContent.sha256}`)
  if (!object) throw new ORPCError('NOT_FOUND')

  return createFileResponse(fileContent.mime, fileContent.byteSize, object.body)
}

export async function getTransformedFileContentResponse(
  input: { id: string; extension: string },
  dimensions: ImageDimensions,
) {
  const fileContent = await findFileContent(input.id)
  assertFileExists(fileContent, input.extension)
  if (fileContent.mime === 'image/gif') throw new UnsupportedImageTransformError()

  const cacheKey = `cache/${fileContent.sha256}/resize-${dimensions.fit ?? 'inside'}-${dimensions.width ?? ''}x${dimensions.height ?? ''}`
  const cachedObject = await storage.open(cacheKey)
  if (cachedObject) {
    return createFileResponse(
      fileContent.mime,
      cachedObject.contentLength ?? undefined,
      cachedObject.body,
    )
  }

  const source = await storage.open(`blobs/${fileContent.sha256}`)
  if (!source) throw new ORPCError('NOT_FOUND')
  const sourceBytes = new Uint8Array(await new Response(source.body).arrayBuffer())
  const transformedBytes = await resizeImageBytes(sourceBytes, dimensions)

  await db.transaction(async (tx) => {
    await lockBlob(tx, fileContent.sha256)
    const existingBlob = await tx
      .select({ sha256: blob.sha256 })
      .from(blob)
      .where(eq(blob.sha256, fileContent.sha256))
      .then(takeUniqueOrNull)

    if (!existingBlob) throw new ORPCError('NOT_FOUND')
    await storage.put(cacheKey, transformedBytes, fileContent.mime)
  })

  return createFileResponse(
    fileContent.mime,
    transformedBytes.byteLength,
    new Response(transformedBytes).body!,
  )
}

export class UnsupportedImageTransformError extends Error {
  constructor() {
    super('GIF resizing is not supported')
    this.name = 'UnsupportedImageTransformError'
  }
}

function assertFileExists(
  fileContent: Awaited<ReturnType<typeof findFileContent>>,
  extension: string,
): asserts fileContent is NonNullable<typeof fileContent> {
  if (!fileContent || fileContent.extension !== extension) {
    throw new ORPCError('NOT_FOUND')
  }
}

function createFileResponse(
  mime: string,
  byteSize: number | undefined,
  body: ReadableStream<Uint8Array>,
) {
  return {
    status: 200 as const,
    headers: {
      'content-type': mime,
      ...(byteSize === undefined ? {} : { 'content-length': String(byteSize) }),
      'x-content-type-options': 'nosniff',
    },
    body,
  }
}

async function findFileContent(id: string) {
  return db
    .select({
      extension: file.extension,
      sha256: blob.sha256,
      mime: blob.mime,
      byteSize: blob.byteSize,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.id, id))
    .then(takeUniqueOrNull)
}
