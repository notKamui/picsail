import { createHash } from 'node:crypto'
import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db, takeUniqueOrNull } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import { transformImageBytes, type ImageOutputFormat } from './image-processing'
import type { ExecutableImageTransform } from './url-transform'
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
              'image/avif': { schema: { type: 'string', format: 'binary' } },
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
  .handler(async ({ input }) => getFileContentResponse(input, []))

const outputFormats: Record<string, { format: ImageOutputFormat; mime: string }> = {
  jpg: { format: 'jpeg', mime: 'image/jpeg' },
  jpeg: { format: 'jpeg', mime: 'image/jpeg' },
  png: { format: 'png', mime: 'image/png' },
  webp: { format: 'webp', mime: 'image/webp' },
  avif: { format: 'avif', mime: 'image/avif' },
}

/**
 * Serves an original or a cached image variant, generating the variant on a miss.
 * Variant generation reads the source into memory and may evict other variants.
 * @param input - Public file ID and requested output extension.
 * @param transforms - Ordered transformations used for the variant and cache key.
 * @returns A 200 response description with the encoded variant stream and headers.
 * @throws NOT_FOUND for missing content or UNSUPPORTED_MEDIA_TYPE for unsupported transforms.
 */
export async function getFileContentResponse(
  input: { id: string; extension: string },
  transforms: ExecutableImageTransform[],
) {
  const fileContent = await findFileContent(input.id)
  if (!fileContent) throw new ORPCError('NOT_FOUND')
  const extension = input.extension.toLowerCase()
  const output = Object.hasOwn(outputFormats, extension) ? outputFormats[extension] : undefined
  if (!output && extension !== fileContent.extension) throw new ORPCError('NOT_FOUND')

  const mime = output?.mime ?? fileContent.mime
  if (transforms.length === 0 && mime === fileContent.mime) {
    const object = await openOriginal(fileContent.sha256)
    return createFileResponse(fileContent.mime, fileContent.byteSize, object.body)
  }

  if (fileContent.mime === 'image/gif' || !output) {
    throw new ORPCError('UNSUPPORTED_MEDIA_TYPE', {
      message: 'GIF transformations are not supported',
    })
  }

  return getVariantResponse(fileContent, transforms, output)
}

async function getVariantResponse(
  fileContent: NonNullable<Awaited<ReturnType<typeof findFileContent>>>,
  transforms: ExecutableImageTransform[],
  output: { format: ImageOutputFormat; mime: string },
) {
  const transformHash = createHash('sha256')
    .update(JSON.stringify({ transforms, format: output.format }))
    .digest('hex')
  const cacheKey = `cache/${fileContent.sha256}/v3-${transformHash}`
  const cachedObject = await openCachedVariant(cacheKey, fileContent.sha256)
  if (cachedObject) {
    return createFileResponse(
      output.mime,
      cachedObject.contentLength ?? undefined,
      cachedObject.body,
    )
  }

  const source = await openOriginal(fileContent.sha256)
  const sourceBytes = new Uint8Array(await new Response(source.body).arrayBuffer())
  const transformedBytes = await transformImageBytes(
    sourceBytes,
    transforms,
    output.mime === fileContent.mime ? undefined : output.format,
  )

  await storeCachedVariant(cacheKey, fileContent.sha256, transformedBytes, output.mime)

  return createFileResponse(
    output.mime,
    transformedBytes.byteLength,
    new Response(transformedBytes).body!,
  )
}

async function openOriginal(sha256: string) {
  const object = await storage.open(`blobs/${sha256}`)
  if (!object) throw new ORPCError('NOT_FOUND')
  return object
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
