import { openapi } from '@orpc/openapi'
import { ORPCError, os } from '@orpc/server'
import { setResponseHeader } from '@tanstack/react-start/server'
import { desc, eq, inArray } from 'drizzle-orm'
import * as z from 'zod'
import { env } from '@/lib/env/server'
import { publicFileUrl } from '@/lib/public-file-url'
import { getSession, isAdmin } from '@/server/auth/session'
import { paginated } from '@/server/db'
import { user } from '@/server/db/schema/auth'
import { blob, file } from '@/server/db/schema/file'

export default os
  .meta(
    openapi({
      method: 'GET',
      path: '/admin/files',
      summary: 'List recent files across all users',
      tags: ['Admin'],
    }),
  )
  .input(
    z.object({
      page: z.coerce.number<number>().int().min(1).default(1),
      pageSize: z.coerce.number<number>().int().default(20),
    }),
  )
  .handler(async ({ input }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const session = await getSession()
    if (!session?.user) throw new ORPCError('UNAUTHORIZED')
    if (!isAdmin(session.user.role)) throw new ORPCError('FORBIDDEN')
    return listRecentFiles(input.page, input.pageSize)
  })

/**
 * Lists a page of recent files across all owners after the procedure authorizes
 * the administrator. Pagination selects IDs before joining blob and owner data.
 * @param page - Requested 1-based page.
 * @param pageSize - Requested size, clamped to 5–50.
 * @returns File and owner details, public URLs and effective pagination metadata.
 */
async function listRecentFiles(page: number, pageSize: number) {
  const result = await paginated({
    table: file,
    where: undefined,
    orderBy: [desc(file.createdAt), desc(file.id)],
    page,
    size: pageSize,
    minSize: 5,
    maxSize: 50,
    getItems: (tx, ids) => {
      if (ids.length === 0) return Promise.resolve([])
      return tx
        .select({
          id: file.id,
          extension: file.extension,
          originalName: file.originalName,
          createdAt: file.createdAt,
          mime: blob.mime,
          size: blob.byteSize,
          ownerId: user.id,
          ownerName: user.name,
          ownerEmail: user.email,
        })
        .from(file)
        .innerJoin(blob, eq(file.blobSha256, blob.sha256))
        .innerJoin(user, eq(file.ownerId, user.id))
        .where(inArray(file.id, ids))
    },
  })

  return {
    files: result.items.map((row) => ({
      ...row,
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
