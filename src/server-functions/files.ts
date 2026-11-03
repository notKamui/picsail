import { createServerFn } from '@tanstack/react-start'
import * as z from 'zod'
import { tryAsync } from '@/lib/try'

export const listOwnedFiles = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ desc, eq }, { env }, { getSession }, { db }, { blob, file }] = await Promise.all([
    import('drizzle-orm'),
    import('@/lib/env/server'),
    import('@/server/auth/session'),
    import('@/server/db'),
    import('@/server/db/schema/file'),
  ])
  const session = await getSession()
  if (!session?.user) {
    return { authenticated: false as const, files: [] }
  }

  const rows = await db
    .select({
      id: file.id,
      extension: file.extension,
      mime: blob.mime,
      byteSize: blob.byteSize,
      originalName: file.originalName,
      createdAt: file.createdAt,
    })
    .from(file)
    .innerJoin(blob, eq(blob.sha256, file.blobSha256))
    .where(eq(file.ownerId, session.user.id))
    .orderBy(desc(file.createdAt))
    .limit(100)

  return {
    authenticated: true as const,
    files: rows.map((row) => ({
      ...row,
      size: Number(row.byteSize),
      publicUrl: new URL(`f/${row.id}.${row.extension}`, env.BASE_URL).toString(),
    })),
  }
})

export const getTestFile = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().regex(/^[a-f0-9]{12}$/i) }))
  .handler(async ({ data }) => {
    const { FileNotFoundError, getFileInfo } = await import('@/server/files/info')
    const [error, info] = await tryAsync(getFileInfo({ hash: data.id }), [FileNotFoundError])
    return error ? null : info
  })
