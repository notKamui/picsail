import { createFileRoute, Link } from '@tanstack/react-router'
import { Blurhash } from '@/components/blurhash'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { eyebrow, title } from '@/components/ui/typography'
import { getTestFile } from '@/server-functions/files'

export const Route = createFileRoute('/test/files/$id/')({
  head: () => ({ meta: [{ title: 'File detail · Picsail' }] }),
  loader: ({ params }) => getTestFile({ data: { id: params.id } }),
  component: FileDetailTestPage,
})

function FileDetailTestPage() {
  const file = Route.useLoaderData()
  const { id } = Route.useParams()

  if (!file) {
    return (
      <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-6 py-12">
        <h1 className={title({ h: 1 })}>File not found</h1>
        <Button variant="outline" asChild>
          <Link to="/test/files">Back to files</Link>
        </Button>
      </main>
    )
  }

  const publicUrl = `/f/${file.hash}.${file.extension}`

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <p className={eyebrow()}>File test</p>
          <h1 className={title({ h: 1 })}>
            {file.originalName || `${file.hash}.${file.extension}`}
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link to="/test/files">Back to files</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>File details</CardTitle>
          <CardDescription>
            {file.mime} · {file.size.toLocaleString()} bytes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {file.mime.startsWith('image/') ? (
            <>
              {file.blurhash ? (
                <section className="space-y-3">
                  <h2 className="font-medium">Blurhash preview</h2>
                  <Blurhash
                    hash={file.blurhash}
                    width="12rem"
                    height="12rem"
                    className="max-w-full rounded-md border border-border"
                  />
                </section>
              ) : null}
              <img
                src={publicUrl}
                alt={file.originalName || file.hash}
                className="max-h-[70svh] max-w-full border border-border object-contain"
              />
            </>
          ) : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-medium">ID</dt>
            <dd className="break-all">{id}</dd>
            <dt className="font-medium">Type</dt>
            <dd>{file.type}</dd>
            <dt className="font-medium">MIME</dt>
            <dd>{file.mime}</dd>
            <dt className="font-medium">Created</dt>
            <dd>{file.createdAt?.toLocaleString() ?? 'Unknown'}</dd>
            <dt className="font-medium">Public URL</dt>
            <dd>
              <a className="break-all underline underline-offset-4" href={publicUrl}>
                {publicUrl}
              </a>
            </dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  )
}
