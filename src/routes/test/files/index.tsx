import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { eyebrow, title } from '@/components/ui/typography'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/test/files/')({
  head: () => ({ meta: [{ title: 'File list test · Picsail' }] }),
  loader: ({ context }) => context.queryClient.query(orpc.files.list.queryOptions()),
  component: FileListTestPage,
})

function FileListTestPage() {
  const { data: result } = useSuspenseQuery(orpc.files.list.queryOptions())

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
      ) : result.files.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No files yet</CardTitle>
            <CardDescription>Upload a file to see it in this list.</CardDescription>
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
    </main>
  )
}
