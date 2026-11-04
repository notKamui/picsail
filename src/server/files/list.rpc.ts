import { openapi } from '@orpc/openapi'
import { os } from '@orpc/server'
import { desc, eq } from 'drizzle-orm'
import { env } from '@/lib/env/server'
import { publicFileUrl } from '@/lib/public-file-url'
import { getSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { blob, file } from '@/server/db/schema/file'

export default os
  .meta(
    openapi({
      method: 'GET',
      path: '/files',
      summary: 'List files owned by the current user',
      tags: ['Files'],
    }),
  )
  .handler(async () => {
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
        publicUrl: publicFileUrl(row.id, row.extension, env.BASE_URL),
      })),
    }
  })
