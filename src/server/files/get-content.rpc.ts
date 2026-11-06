import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import { resizeImageBytes, type ImageDimensions } from './image-processing'
import { openCachedVariant, storeCachedVariant } from './variant-cache'

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

/**
 * Opens an original for the public file route and the oRPC content procedure.
 * Reads file/blob metadata from PostgreSQL and the original stream from S3.
 * @param input - Public file ID and expected extension.
 * @returns A 200 response description with MIME, length and readable body stream.
 * @throws NOT_FOUND if the file, extension or stored object is missing.
 */
export async function getFileContentResponse(input: { id: string; extension: string }) {
  const fileContent = await findFileContent(input.id)
  assertFileExists(fileContent, input.extension)

  const object = await storage.open(`blobs/${fileContent.sha256}`)
  if (!object) throw new ORPCError('NOT_FOUND')

  return createFileResponse(fileContent.mime, fileContent.byteSize, object.body)
}

/**
 * Serves a public resized image from cache or generates and stores it on a miss.
 * Reads the source into memory and may update the cache and evict other variants.
 * @param input - Public file ID and expected extension.
 * @param dimensions - Width, height and fit used for the variant and cache key.
 * @returns A 200 response description with the encoded variant stream and headers.
 * @throws NOT_FOUND for missing content or UnsupportedImageTransformError for GIFs.
 */
export async function getTransformedFileContentResponse(
  input: { id: string; extension: string },
  dimensions: ImageDimensions,
) {
  const fileContent = await findFileContent(input.id)
  assertFileExists(fileContent, input.extension)
  if (fileContent.mime === 'image/gif') throw new UnsupportedImageTransformError()

  const cacheKey = `cache/${fileContent.sha256}/resize-${dimensions.fit ?? 'inside'}-${dimensions.width ?? ''}x${dimensions.height ?? ''}`
  const cachedObject = await openCachedVariant(cacheKey, fileContent.sha256)
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

  await storeCachedVariant(cacheKey, fileContent.sha256, transformedBytes, fileContent.mime)

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

/**
 * Validates metadata before serving an original or transformed public file.
 * @param fileContent - Metadata lookup result, possibly null.
 * @param extension - Extension requested in the public URL.
 * @returns Nothing; narrows fileContent to a non-null value.
 * @throws NOT_FOUND if metadata is absent or the extension does not match.
 */
function assertFileExists(
  fileContent: Awaited<ReturnType<typeof findFileContent>>,
  extension: string,
): asserts fileContent is NonNullable<typeof fileContent> {
  if (!fileContent || fileContent.extension !== extension) {
    throw new ORPCError('NOT_FOUND')
  }
}

/**
 * Constructs the shared oRPC/route response description without consuming its body.
 * @param mime - Content type of the encoded image.
 * @param byteSize - Known body size, or undefined to omit Content-Length.
 * @param body - Readable stream owned by the response consumer.
 * @returns Status, safe content headers and the supplied stream.
 */
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

/**
 * Looks up the blob storage metadata needed to serve a public file.
 * @param id - Public file ID.
 * @returns Joined metadata or null if no matching file and blob exist.
 */
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
