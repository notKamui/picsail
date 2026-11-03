import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import * as z from 'zod'
import { Blurhash } from '@/components/blurhash'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { eyebrow, title } from '@/components/ui/typography'
import { tryAsync } from '@/lib/try'
import { getTestFile } from '@/server-functions/files'

export const Route = createFileRoute('/test/files/$id/')({
  head: () => ({ meta: [{ title: 'File detail · Picsail' }] }),
  loader: ({ params }) => getTestFile({ data: { id: params.id } }),
  component: FileDetailTestPage,
})

const deleteErrorSchema = z.object({ error: z.string() })

function FileDetailTestPage() {
  const file = Route.useLoaderData()
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeleteError(null)
    if (!window.confirm('Delete this file permanently? This cannot be undone.')) return

    setIsDeleting(true)
    const [requestError, response] = await tryAsync(
      fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCode }),
      }),
    )
    if (requestError) {
      setIsDeleting(false)
      setDeleteError('Could not reach the delete endpoint.')
      return
    }

    const [bodyError, body] = await tryAsync(response.json())
    if (bodyError) {
      setIsDeleting(false)
      setDeleteError(
        'Could not confirm the delete result. Refresh the page to check whether the file was removed.',
      )
      return
    }

    if (!response.ok) {
      const parsedError = deleteErrorSchema.safeParse(body)
      setIsDeleting(false)
      setDeleteError(parsedError.success ? parsedError.data.error : 'Could not delete the file.')
      return
    }

    setIsDeleting(false)
    await navigate({ to: '/test/files' })
  }

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
          <form onSubmit={handleDelete} className="space-y-4 border-t border-border pt-6">
            <div className="space-y-1">
              <h2 className="font-medium">Delete file</h2>
              <p className="text-sm text-muted-foreground">
                This permanently removes the file. Enter the delete code provided when it was
                uploaded.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="delete-code">Delete code</FieldLabel>
              <Input
                id="delete-code"
                type="password"
                autoComplete="off"
                required
                value={deleteCode}
                onChange={(event) => setDeleteCode(event.currentTarget.value)}
              />
              <FieldDescription>The code is case-insensitive.</FieldDescription>
            </Field>
            {deleteError ? (
              <Field data-invalid>
                <FieldError>{deleteError}</FieldError>
              </Field>
            ) : null}
            <Button type="submit" variant="destructive" disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete file'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
