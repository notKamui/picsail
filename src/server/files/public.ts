import { ORPCError, os } from '@orpc/server'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'
import { storage } from '@/server/storage'

export type GetPublicFileInput = {
  id: string
  extension: string
}

export type PublicFile = {
  body: ReadableStream<Uint8Array>
  mime: string
  size: number
}

export const getFileContent = os
  .route({
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
  })
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
  .handler(async ({ input }) => {
    const file = await getPublicFile(input)
    if (!file) {
      throw new ORPCError('NOT_FOUND')
    }

    return {
      status: 200 as const,
      headers: {
        'content-type': file.mime,
        'content-length': String(file.size),
        'x-content-type-options': 'nosniff',
      },
      body: file.body,
    }
  })

export async function getPublicFile({
  id,
  extension,
}: GetPublicFileInput): Promise<PublicFile | null> {
  const [row] = await db
    .select({
      extension: file.extension,
      sha256: blob.sha256,
      mime: blob.mime,
      byteSize: blob.byteSize,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.id, id))
    .limit(1)

  if (!row || row.extension !== extension) return null

  const object = await storage.open(`blobs/${row.sha256}`)
  if (!object) return null

  return {
    body: object.body,
    mime: row.mime,
    size: Number(row.byteSize),
  }
}
