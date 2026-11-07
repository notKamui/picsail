import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Copy, ImagePlus } from 'lucide-react'
import { useRef, useState, type DragEvent, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { copyLink } from '@/lib/copy-link'
import { orpc } from '@/lib/orpc'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/_workspace/upload/')({
  head: () => ({ meta: [{ title: 'Upload · Picsail' }] }),
  component: UploadForm,
})

function UploadForm() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const upload = useMutation(orpc.files.upload.mutationOptions())

  /**
   * Replaces the pending browser selection and clears a previous upload error.
   * @param next - The selected image, or undefined when selection was cleared.
   */
  function chooseFile(next: File | undefined) {
    setFile(next ?? null)
    setError(null)
  }

  /**
   * Accepts exactly one dropped file for the upload form.
   * @param event - Browser drop event containing the dropped files.
   */
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (upload.isPending) return
    if (event.dataTransfer.files.length !== 1) {
      setError('Please choose one image at a time.')
      return
    }
    chooseFile(event.dataTransfer.files[0])
  }

  /**
   * Uploads the selected file, displays its public link, and invalidates cached file data.
   * @param event - Upload form submission event.
   * @returns A promise resolving after the request and cache refresh, or a displayed failure.
   */
  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
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

  /**
   * Copies the uploaded image's public URL, reporting clipboard availability and errors.
   * @returns A promise resolving after the copy result is displayed.
   */
  async function copyUrl() {
    if (!uploadedUrl) return
    setCopyMessage(await copyLink(uploadedUrl))
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
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <output className="sr-only">Image uploaded successfully.</output>
          <h2 className="font-serif text-2xl font-semibold">Your image is ready.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Share this public link wherever you like.
          </p>
          <a
            href={uploadedUrl}
            className="mt-4 block text-sm break-all underline underline-offset-4"
          >
            {uploadedUrl}
          </a>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={copyUrl}>
              <Copy aria-hidden="true" /> Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadedUrl(null)
                setCopyMessage(null)
              }}
            >
              Upload another
            </Button>
            <Button asChild variant="ghost">
              <Link to="/files">View my files</Link>
            </Button>
          </div>
          {copyMessage && <output className="mt-3 block text-sm">{copyMessage}</output>}
        </div>
      ) : (
        <form onSubmit={handleUpload} className="mt-8">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              if (!upload.isPending) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? 'border-foreground bg-accent' : 'border-border bg-card'
            }`}
          >
            <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-secondary">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <p className="font-serif text-xl font-semibold">
              {file ? 'Ready to upload' : 'Drop an image here'}
            </p>
            <p className="mt-2 max-w-full truncate text-sm text-muted-foreground">
              {file ? file.name : 'JPEG, PNG, GIF or WebP'}
            </p>
            <input
              ref={inputRef}
              id="image-upload"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Image file"
              disabled={upload.isPending}
              onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-6"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {file ? 'Choose another image' : 'Choose an image'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="mt-4" disabled={!file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload image'}
          </Button>
        </form>
      )}
    </section>
  )
}
