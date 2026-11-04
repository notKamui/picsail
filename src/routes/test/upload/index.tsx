import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { eyebrow, title } from '@/components/ui/typography'
import { uploadImageForUser } from '@/functions/files'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/test/upload/')({
  head: () => ({ meta: [{ title: 'Upload test · Picsail' }] }),
  component: UploadTestPage,
})

type UploadResult = {
  id: string
  url: string
  deleteCode: string
  size: number
}

function UploadTestPage() {
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const uploadImage = useServerFn(uploadImageForUser)

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setUpload(null)

    const formData = new FormData(event.currentTarget)
    setIsUploading(true)
    const [requestError, result] = await tryAsync(uploadImage({ data: formData }))
    setIsUploading(false)
    if (requestError) {
      setError(requestError.message || 'Could not complete the upload.')
      return
    }

    if (result.status === 'invalid-file') {
      setError('Choose a file to upload.')
      return
    }
    if (result.status === 'unauthorized') {
      setError('Sign in before uploading a file.')
      return
    }
    if (result.status === 'error') {
      setError(result.message)
      return
    }
    setUpload(result.upload)
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <p className={eyebrow()}>Test tools</p>
          <h1 className={title({ h: 1 })}>Upload a file</h1>
        </div>
        <Button variant="outline" asChild>
          <Link to="/test/files">My files</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Multipart upload</CardTitle>
          <CardDescription>
            Upload a JPEG, PNG, GIF, or WebP to test the current endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="file">File</FieldLabel>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  required
                />
              </Field>
              {error ? (
                <Field data-invalid>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Uploading…' : 'Upload'}
              </Button>
            </FieldGroup>
          </form>

          {upload ? (
            <section className="mt-6 space-y-3 border-t border-border pt-6">
              <h2 className="font-serif text-xl font-semibold">Upload complete</h2>
              <p className="text-sm">ID: {upload.id}</p>
              <p className="text-sm">Size: {upload.size.toLocaleString()} bytes</p>
              <p className="text-sm break-all">Delete code: {upload.deleteCode}</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/test/files/$id" params={{ id: upload.id }}>
                    View file
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href={upload.url} target="_blank" rel="noreferrer">
                    Open public URL
                  </a>
                </Button>
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
