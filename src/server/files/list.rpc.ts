import { openapi } from '@orpc/openapi'
import { os } from '@orpc/server'
import { desc, eq, inArray } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { publicFileUrl } from '@/lib/public-file-url'
import { getSession } from '@/server/auth/session'
import { paginated } from '@/server/db'
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
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().default(20),
    }),
  )
  .handler(async ({ input }) => {
    const session = await getSession()
    if (!session?.user) {
      return { authenticated: false as const, files: [] as const }
    }

    return {
      authenticated: true as const,
      ...(await listFilesForUser(session.user.id, input.page, input.pageSize)),
    }
  })

async function listFilesForUser(ownerId: string, requestedPage: number, requestedPageSize: number) {
  const result = await paginated({
    table: file,
    where: eq(file.ownerId, ownerId),
    orderBy: [desc(file.createdAt), desc(file.id)],
    page: requestedPage,
    size: requestedPageSize,
    minSize: 5,
    maxSize: 50,
    getItems: (tx, ids) => {
      if (ids.length === 0) return Promise.resolve([])

      return tx
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
        .where(inArray(file.id, ids))
    },
  })

  return {
    files: result.items.map((row) => ({
      ...row,
      size: Number(row.byteSize),
      publicUrl: publicFileUrl(row.id, row.extension, env.BASE_URL),
    })),
    pagination: {
      page: result.page,
      pageSize: result.size,
      total: result.total,
      totalPages: result.totalPages,
    },
  }
}
