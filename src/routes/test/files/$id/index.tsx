import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Blurhash } from '@/components/blurhash'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError } from '@/components/ui/field'
import { eyebrow, title } from '@/components/ui/typography'
import { orpc } from '@/lib/orpc'
import { publicFilePath } from '@/lib/public-file-url'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/test/files/$id/')({
  head: () => ({ meta: [{ title: 'File detail · Picsail' }] }),
  loader: ({ context, params }) =>
    context.queryClient.query(orpc.files.getMetadata.queryOptions({ input: { id: params.id } })),
  component: FileDetailTestPage,
})

function FileDetailTestPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: file } = useSuspenseQuery(orpc.files.getMetadata.queryOptions({ input: { id } }))
  const deleteMutation = useMutation(
    orpc.files.delete.mutationOptions({
      onSuccess: async (result) => {
        if (result.deleted) {
          await queryClient.invalidateQueries({ queryKey: orpc.files.list.key() })
        }
      },
    }),
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeleteError(null)
    if (!window.confirm('Delete this file permanently? This cannot be undone.')) return

    const [deleteError, result] = await tryAsync(deleteMutation.mutateAsync({ id }))
    if (deleteError) {
      setDeleteError('Could not delete the file. Please try again.')
      return
    }

    if (!result.deleted) {
      setDeleteError('Could not delete the file.')
      return
    }

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

  const publicUrl = publicFilePath(file.hash, file.extension)

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
                This permanently removes the file. Only its owner or an admin can delete it.
              </p>
            </div>
            {deleteError ? (
              <Field data-invalid>
                <FieldError>{deleteError}</FieldError>
              </Field>
            ) : null}
            <Button type="submit" variant="destructive" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete file'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
