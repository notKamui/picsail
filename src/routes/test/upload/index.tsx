import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { eyebrow, title } from '@/components/ui/typography'
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

const uploadResultSchema = z.object({
  id: z.string(),
  url: z.string(),
  deleteCode: z.string(),
  size: z.number(),
})

const uploadErrorSchema = z.object({
  error: z.string(),
})

function UploadTestPage() {
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setUpload(null)

    const formData = new FormData(event.currentTarget)
    const selectedFile = formData.get('file')
    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      setError('Choose a file to upload.')
      return
    }

    setIsUploading(true)
    const [requestError, response] = await tryAsync(
      fetch('/api/upload', { method: 'POST', body: formData }),
    )
    setIsUploading(false)
    if (requestError) {
      setError('Could not reach the upload endpoint.')
      return
    }

    const [bodyError, body] = await tryAsync(response.json())
    if (bodyError) {
      setError('The upload endpoint returned an invalid response.')
      return
    }

    if (!response.ok) {
      const parsedError = uploadErrorSchema.safeParse(body)
      setError(parsedError.success ? parsedError.data.error : 'Upload failed.')
      return
    }

    const parsedUpload = uploadResultSchema.safeParse(body)
    if (!parsedUpload.success) {
      setError('The upload endpoint returned an invalid response.')
      return
    }
    setUpload(parsedUpload.data)
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
