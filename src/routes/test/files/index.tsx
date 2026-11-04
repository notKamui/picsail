import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { eyebrow, title } from '@/components/ui/typography'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/test/files/')({
  head: () => ({ meta: [{ title: 'File list test · Picsail' }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    page: parseInteger(search.page, 1),
    pageSize: clampPageSize(parseInteger(search.pageSize, 20)),
  }),
  loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
  loader: ({ context, deps }) =>
    context.queryClient.query(
      orpc.files.list.queryOptions({ input: { page: deps.page, pageSize: deps.pageSize } }),
    ),
  component: FileListTestPage,
})

function FileListTestPage() {
  const { page, pageSize } = Route.useSearch()
  const navigate = useNavigate()
  const [pageSizeInput, setPageSizeInput] = useState(String(pageSize))
  const { data: result } = useSuspenseQuery(
    orpc.files.list.queryOptions({ input: { page, pageSize } }),
  )
  const currentPage = result.authenticated ? result.pagination.page : page

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <p className={eyebrow()}>Test tools</p>
          <h1 className={title({ h: 1 })}>My files</h1>
        </div>
        <Button asChild>
          <Link to="/test/upload">Upload a file</Link>
        </Button>
      </header>

      {!result.authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Sign in to see files uploaded by your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {result.pagination.total.toLocaleString()} files
            </p>
            <label htmlFor="files-page-size" className="flex items-center gap-2 text-sm">
              Per page
              <Input
                key={pageSize}
                id="files-page-size"
                type="number"
                min={5}
                max={50}
                value={pageSizeInput}
                aria-label="Files per page"
                className="w-20"
                onChange={(event) => setPageSizeInput(event.currentTarget.value)}
                onBlur={() => {
                  const nextPageSize = clampPageSize(parseInteger(pageSizeInput, pageSize))
                  setPageSizeInput(String(nextPageSize))
                  if (nextPageSize !== pageSize) {
                    void navigate({
                      to: '/test/files',
                      search: { page: 1, pageSize: nextPageSize },
                    })
                  }
                }}
              />
            </label>
          </div>
          {result.files.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {result.pagination.total === 0 ? 'No files yet' : 'No files on this page'}
                </CardTitle>
                <CardDescription>
                  {result.pagination.total === 0
                    ? 'Upload a file to see it in this list.'
                    : 'Go to another page to find your files.'}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <ul className="flex flex-col gap-4">
              {result.files.map((file) => (
                <li key={file.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{file.originalName || `${file.id}.${file.extension}`}</CardTitle>
                      <CardDescription>
                        {file.mime} · {file.size.toLocaleString()} bytes ·{' '}
                        {file.createdAt.toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                      <Button size="sm" asChild>
                        <Link to="/test/files/$id" params={{ id: file.id }}>
                          Details
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={file.publicUrl} target="_blank" rel="noreferrer">
                          Public file
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {result.authenticated && result.pagination.totalPages > 1 ? (
        <nav aria-label="File list pages" className="flex items-center justify-between gap-4">
          {currentPage > 1 ? (
            <Button variant="outline" asChild>
              <Link to="/test/files" search={{ page: currentPage - 1, pageSize }}>
                Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Previous
            </Button>
          )}
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Page {result.pagination.page} of {result.pagination.totalPages} ·{' '}
            {result.pagination.total.toLocaleString()} files
          </p>
          {currentPage < result.pagination.totalPages ? (
            <Button variant="outline" asChild>
              <Link to="/test/files" search={{ page: currentPage + 1, pageSize }}>
                Next
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Next
            </Button>
          )}
        </nav>
      ) : null}
    </main>
  )
}

function parseInteger(value: unknown, fallback: number) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : fallback
}

function clampPageSize(pageSize: number) {
  return Math.min(50, Math.max(5, pageSize))
}
