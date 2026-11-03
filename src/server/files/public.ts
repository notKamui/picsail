import { eq } from 'drizzle-orm'
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
