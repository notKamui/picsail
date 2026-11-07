import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, Copy, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { personalFilesQueryOptions } from '@/lib/file-list-query'
import { orpc } from '@/lib/orpc'
import { publicFilePath } from '@/lib/public-file-url'
import { tryAsync } from '@/lib/try'
import { useHydrated } from '@/lib/use-hydrated'

export function UploadWorkspace({ userId }: { userId: string }) {
  const hydrated = useHydrated()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const upload = useMutation(orpc.files.upload.mutationOptions())
  const files = useQuery(personalFilesQueryOptions(userId, page))

  /**
   * Replaces the pending browser selection and clears a previous upload error.
   * @param next - The selected image, or undefined when selection was cleared.
   */
  function chooseFile(next: File | undefined) {
    setFile(next ?? null)
    setUploadError(null)
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
      setUploadError('Please choose one image at a time.')
      return
    }
    chooseFile(event.dataTransfer.files[0])
  }

  /**
   * Uploads the selected file through oRPC and refreshes the owner's listing.
   * On success, opens the file's details and clears the local selection.
   * @param event - Upload form submission event.
   * @returns A promise that resolves after the upload and query refresh.
   */
  async function handleUpload(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || upload.isPending) return
    setUploadError(null)
    const [error, result] = await tryAsync(upload.mutateAsync({ file }))
    if (error) {
      setUploadError(error.message || 'Could not upload this image. Please try again.')
      return
    }
    if (result.status !== 'ok') {
      setUploadError(
        result.status === 'error'
          ? result.message
          : result.status === 'unauthorized'
            ? 'Your session has expired. Please sign in again.'
            : 'Please choose a non-empty image.',
      )
      return
    }
    setSelectedId(result.hash)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    setPage(1)
    await queryClient.invalidateQueries({ queryKey: orpc.files.list.key() })
    await queryClient.invalidateQueries({ queryKey: orpc.files.getMetadata.key() })
  }

  return (
    <>
      <section className="grid gap-8 pt-12 pb-12 md:grid-cols-[1fr_1.15fr] md:gap-16 md:pt-20">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Your image library
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            A place for your pictures.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
            Upload an image to create a public link. Your files stay here whenever you need them.
          </p>
        </div>

        <form onSubmit={handleUpload}>
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
          {uploadError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {uploadError}
            </p>
          )}
          <Button type="submit" className="mt-4 w-full" disabled={!file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload image'}
          </Button>
        </form>
      </section>

      {selectedId && (
        <FileDetails key={selectedId} id={selectedId} onDeleted={() => setSelectedId(null)} />
      )}

      <section className="border-t border-border pt-10" aria-labelledby="files-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Your collection
            </p>
            <h2 id="files-heading" className="mt-2 font-serif text-3xl font-semibold">
              My files
            </h2>
          </div>
          {files.data?.authenticated && (
            <p className="text-sm text-muted-foreground">
              {hydrated
                ? files.data.pagination.total.toLocaleString()
                : files.data.pagination.total}{' '}
              files
            </p>
          )}
        </div>
        {files.isPending ? (
          <output className="block py-10 text-sm text-muted-foreground">Loading your files…</output>
        ) : files.isError ? (
          <p role="alert" className="py-10 text-sm text-destructive">
            Could not load your files. Please refresh the page.
          </p>
        ) : !files.data?.authenticated ? (
          <p className="py-10 text-sm text-muted-foreground">
            Your session has expired. Please sign in again.
          </p>
        ) : files.data.files.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">
            No images here yet. Your uploads will appear in this collection.
          </p>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {files.data.files.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.originalName || `${item.id}.${item.extension}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.mime} · {hydrated ? item.size.toLocaleString() : item.size} bytes
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(item.id)}>
                    Details
                  </Button>
                </li>
              ))}
            </ul>
            {files.data.pagination.totalPages > 1 && (
              <nav
                aria-label="File list pages"
                className="mt-6 flex items-center justify-between gap-3"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={files.data.pagination.page <= 1}
                  onClick={() =>
                    files.data?.authenticated && setPage(files.data.pagination.page - 1)
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {files.data.pagination.page} of {files.data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={files.data.pagination.page >= files.data.pagination.totalPages}
                  onClick={() =>
                    files.data?.authenticated && setPage(files.data.pagination.page + 1)
                  }
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </>
  )
}

function FileDetails({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const detailsRef = useRef<HTMLElement>(null)
  const queryClient = useQueryClient()
  const metadata = useQuery(orpc.files.getMetadata.queryOptions({ input: { id } }))
  const deletion = useMutation(orpc.files.delete.mutationOptions())
  const [error, setError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  useEffect(() => {
    detailsRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  /**
   * Confirms and requests deletion via oRPC, then refreshes cached file data.
   * @returns A promise resolving after deletion or a displayed failure.
   */
  async function deleteFile() {
    if (!window.confirm('Delete this file permanently? This cannot be undone.')) return
    setError(null)
    const [requestError, result] = await tryAsync(deletion.mutateAsync({ id }))
    if (requestError || !result.deleted) {
      setError('Could not delete this file. Please try again.')
      return
    }
    await queryClient.invalidateQueries({ queryKey: orpc.files.list.key() })
    await queryClient.invalidateQueries({ queryKey: orpc.files.getMetadata.key() })
    onDeleted()
  }

  const file = metadata.data
  const url = file
    ? new URL(publicFilePath(file.hash, file.extension), window.location.origin).href
    : ''

  /**
   * Copies the selected file's absolute public URL using the browser clipboard.
   * @returns A promise resolving after reporting clipboard success or failure.
   */
  async function copyUrl() {
    if (!navigator.clipboard) {
      setCopyMessage('Clipboard unavailable. Select the link above to copy it.')
      return
    }
    const [error] = await tryAsync(navigator.clipboard.writeText(url))
    setCopyMessage(error ? 'Could not copy the link. Select it above to copy it.' : 'Link copied.')
  }

  return (
    <section
      ref={detailsRef}
      aria-labelledby="file-details-heading"
      className="mb-12 rounded-xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Selected image
          </p>
          <h2 id="file-details-heading" className="mt-2 font-serif text-2xl font-semibold">
            File details
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onDeleted}>
          Close
        </Button>
      </div>
      {metadata.isPending ? (
        <output className="mt-6 block text-sm text-muted-foreground">Loading image…</output>
      ) : metadata.isError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Could not load file details.
        </p>
      ) : !file ? (
        <p className="mt-6 text-sm text-muted-foreground">This file could not be found.</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg bg-secondary">
            <img
              src={publicFilePath(file.hash, file.extension)}
              alt={file.originalName || 'Uploaded image'}
              className="max-h-64 w-full object-contain"
            />
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <p className="font-medium break-all">
                {file.originalName || `${file.hash}.${file.extension}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {file.mime} · {file.size.toLocaleString()} bytes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ID {file.hash} · Created {file.createdAt.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Public link
              </p>
              <a href={url} className="text-sm break-all underline underline-offset-4">
                {url}
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyUrl}>
                <Copy aria-hidden="true" /> Copy link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" /> Open image
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={url} download>
                  <ArrowDownToLine aria-hidden="true" /> Download
                </a>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteFile}
                disabled={deletion.isPending}
              >
                <Trash2 aria-hidden="true" /> {deletion.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
            {copyMessage && <output className="block text-sm">{copyMessage}</output>}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
