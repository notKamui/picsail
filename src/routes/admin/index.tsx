import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { currentUserQueryOptions } from '@/lib/session-query'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Admin files · Picsail' }] }),
  beforeLoad: async ({ context }) => {
    await context.queryClient.query({ ...currentUserQueryOptions(), staleTime: 0 })
  },
  component: AdminPage,
})

function AdminPage() {
  const { data: user, error } = useQuery(currentUserQueryOptions())

  return (
    <main className="mx-auto min-h-svh max-w-5xl px-5 pb-20 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-border py-6">
        <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
          Picsail<span className="text-muted-foreground">.</span>
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Back to my files</Link>
        </Button>
      </header>
      <section className="pt-12" aria-labelledby="admin-heading">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Administration
        </p>
        <h1 id="admin-heading" className="mt-3 font-serif text-4xl font-semibold">
          Recent files
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Review and remove files uploaded by any user.
        </p>
        {error ? (
          <p role="alert" className="mt-8 text-sm text-destructive">
            Could not verify your session. Please refresh the page.
          </p>
        ) : !user ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">Sign in to access administration.</p>
            <Button asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
        ) : !user.isAdmin ? (
          <p role="alert" className="mt-8 text-sm text-destructive">
            Administrator access is required.
          </p>
        ) : (
          <AdminFiles key={user.id} userId={user.id} />
        )}
      </section>
    </main>
  )
}

function AdminFiles({ userId }: { userId: string }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const files = useQuery(
    orpc.admin.listFiles.queryOptions({
      input: { page, pageSize },
      queryKey: [...orpc.admin.listFiles.key(), userId, page, pageSize],
      staleTime: 0,
      retry: false,
    }),
  )
  const deletion = useMutation(orpc.files.delete.mutationOptions())

  /**
   * Confirms and deletes one file through the owner/admin-authorized procedure,
   * then refreshes both the administrative and personal file lists.
   * @param id - Public ID of the file selected by the administrator.
   * @param name - Display name included in the confirmation.
   * @returns A promise resolving after cache refresh or a displayed failure.
   */
  async function deleteFile(id: string, name: string) {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return
    setError(null)
    const [requestError, result] = await tryAsync(deletion.mutateAsync({ id }))
    if (requestError || !result.deleted) {
      setError('Could not delete the file. Check your permissions and try again.')
      return
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.admin.listFiles.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.files.list.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.files.getMetadata.key() }),
    ])
  }

  if (files.isPending) {
    return <output className="block py-10 text-sm text-muted-foreground">Loading files…</output>
  }
  if (files.isError) {
    return (
      <p role="alert" className="py-10 text-sm text-destructive">
        Could not load files. Check your session and administrator permissions, then try again.
      </p>
    )
  }

  const { pagination } = files.data
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {pagination.total.toLocaleString()} {pagination.total === 1 ? 'file' : 'files'}
        </p>
        <label className="flex items-center gap-2 text-sm">
          Per page
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.currentTarget.value))
              setPage(1)
            }}
            className="rounded-md border border-border bg-card px-2 py-1 focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {files.data.files.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">There are no files to review.</p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {files.data.files.map((file) => {
            const name = file.originalName || `${file.id}.${file.extension}`
            return (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <p className="font-medium break-all">{name}</p>
                  <p className="mt-1 text-sm break-all text-muted-foreground">
                    {file.ownerName} · {file.ownerEmail}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {file.mime} · {file.size.toLocaleString()} bytes ·{' '}
                    {file.createdAt.toLocaleString()} · {file.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={file.publicUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletion.isPending}
                    onClick={() => deleteFile(file.id, name)}
                    aria-label={`Delete ${name}`}
                  >
                    {deletion.isPending && deletion.variables?.id === file.id
                      ? 'Deleting…'
                      : 'Delete'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {pagination.totalPages > 1 && (
        <nav aria-label="File list pages" className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            Previous
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}
