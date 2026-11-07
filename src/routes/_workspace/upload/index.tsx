import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { orpc } from '@/lib/orpc'
import { tryAsync } from '@/lib/try'
import { UploadForm } from './-upload-form'
import { UploadSuccess } from './-upload-success'

export const Route = createFileRoute('/_workspace/upload/')({
  head: () => ({ meta: [{ title: 'Upload · Picsail' }] }),
  component: UploadPage,
})

function UploadPage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const upload = useMutation(orpc.files.upload.mutationOptions())

  function chooseFile(next: File | undefined) {
    setFile(next ?? null)
    setError(null)
  }

  async function handleUpload() {
    if (!file || upload.isPending) return
    setError(null)
    const [requestError, result] = await tryAsync(upload.mutateAsync({ file }))
    if (requestError) {
      setError(requestError.message || 'Could not upload this image. Please try again.')
      return
    }
    if (result.status !== 'ok') {
      setError(
        result.status === 'error'
          ? result.message
          : result.status === 'unauthorized'
            ? 'Your session has expired. Please sign in again.'
            : 'Please choose a non-empty image.',
      )
      return
    }
    setUploadedUrl(result.url)
    setFile(null)
    await queryClient.invalidateQueries({ queryKey: orpc.files.list.key() })
    await queryClient.invalidateQueries({ queryKey: orpc.files.getMetadata.key() })
  }

  return (
    <section className="mx-auto max-w-2xl pt-10 sm:pt-14" aria-labelledby="upload-heading">
      <Link
        to="/files"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to my files
      </Link>
      <h1
        id="upload-heading"
        className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl"
      >
        Upload an image
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add an image to your library and create a public link.
      </p>

      {uploadedUrl ? (
        <UploadSuccess url={uploadedUrl} onReset={() => setUploadedUrl(null)} />
      ) : (
        <UploadForm
          file={file}
          error={error}
          isPending={upload.isPending}
          onChooseFile={chooseFile}
          onError={setError}
          onUpload={handleUpload}
        />
      )}
    </section>
  )
}
