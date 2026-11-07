import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ImagePlus } from 'lucide-react'
import { useState } from 'react'
import { Blurhash } from '@/components/blurhash'
import { FileDetailsDialog } from '@/components/file-details-dialog'
import { FilePagination } from '@/components/file-pagination'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { personalFilesQueryOptions } from '@/lib/file-list-query'
import { formatNumber } from '@/lib/format'
import { thumbnailFilePath } from '@/lib/public-file-url'

export function UploadWorkspace({ userId }: { userId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const files = useQuery(personalFilesQueryOptions(userId, page))

  return (
    <>
      <section className="pt-10 sm:pt-14" aria-labelledby="files-heading">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1
              id="files-heading"
              className="font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
            >
              My files
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {files.data?.authenticated
                ? `${formatNumber(files.data.pagination.total)} ${files.data.pagination.total === 1 ? 'image' : 'images'} in your library`
                : 'Your image library'}
            </p>
          </div>
          <Button asChild>
            <Link to="/upload">
              <ImagePlus aria-hidden="true" /> Upload image
            </Link>
          </Button>
        </div>

        {selectedId && (
          <FileDetailsDialog key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />
        )}

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
          <EmptyState
            className="mt-6"
            icon={<ImagePlus aria-hidden="true" />}
            title="Your collection starts here."
            description="Use Upload image to add your first image."
          />
        ) : (
          <>
            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {files.data.files.map((item) => (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="group w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-lg bg-secondary">
                      {item.blurhash && (
                        <Blurhash
                          hash={item.blurhash}
                          width="100%"
                          height="100%"
                          className="absolute inset-0"
                          alt=""
                        />
                      )}
                      <img
                        src={thumbnailFilePath(item.id, item.extension)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover outline -outline-offset-1 outline-black/10 transition-opacity dark:outline-white/10"
                        onError={(event) => {
                          console.error('Could not load thumbnail:', item.id)
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    </span>
                    <span className="mt-3 block truncate text-sm font-semibold group-hover:underline">
                      {item.originalName || `${item.id}.${item.extension}`}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                      {formatNumber(item.size)} bytes
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <FilePagination
              page={files.data.pagination.page}
              totalPages={files.data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </>
  )
}
