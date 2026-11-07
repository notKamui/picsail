import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { copyLink } from '@/lib/copy-link'
import { formatDateLong, formatNumber } from '@/lib/format'
import { orpc } from '@/lib/orpc'
import { publicFilePath } from '@/lib/public-file-url'
import { tryAsync } from '@/lib/try'

export function FileDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const metadata = useQuery(orpc.files.getMetadata.queryOptions({ input: { id } }))
  const deletion = useMutation(orpc.files.delete.mutationOptions())
  const [error, setError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

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
    onClose()
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
    setCopyMessage(await copyLink(url))
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">File details</DialogTitle>
          <DialogDescription>Preview, share, or delete this image.</DialogDescription>
        </DialogHeader>
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
                className="max-h-64 w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
              />
            </div>
            <div className="min-w-0 space-y-4">
              <div>
                <p className="font-medium break-all">
                  {file.originalName || `${file.hash}.${file.extension}`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {file.mime} · {formatNumber(file.size)} bytes
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ID {file.hash} · Created {formatDateLong(file.createdAt)}
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
      </DialogContent>
    </Dialog>
  )
}
