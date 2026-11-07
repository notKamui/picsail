import { orpc } from '@/lib/orpc'

export const DEFAULT_FILE_PAGE_SIZE = 20

/**
 * Builds the owner-scoped query shared by the home loader and file list.
 * The owner ID isolates browser cache entries; the server still authorizes each request.
 * @param userId - Current user's ID for cache isolation.
 * @param page - Requested 1-based page.
 * @returns Typed oRPC query options for the personal file list.
 */
export function personalFilesQueryOptions(userId: string, page: number) {
  return orpc.files.list.queryOptions({
    input: { page, pageSize: DEFAULT_FILE_PAGE_SIZE },
    queryKey: [...orpc.files.list.key(), userId, page],
    retry: false,
  })
}

/**
 * Builds the admin-scoped query shared by the admin loader and file list.
 * The server independently checks the current user's admin role on every request.
 * @param userId - Current administrator's ID for cache isolation.
 * @param page - Requested 1-based page.
 * @param pageSize - Requested number of files per page.
 * @returns Typed oRPC query options for the administrative file list.
 */
export function adminFilesQueryOptions(userId: string, page: number, pageSize: number) {
  return orpc.admin.listFiles.queryOptions({
    input: { page, pageSize },
    queryKey: [...orpc.admin.listFiles.key(), userId, page, pageSize],
    staleTime: 30_000,
    retry: false,
  })
}
