import { ImagePlus } from 'lucide-react'
import { useRef, useState, type DragEvent, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'

export function UploadForm({
  file,
  error,
  isPending,
  onChooseFile,
  onError,
  onUpload,
}: {
  file: File | null
  error: string | null
  isPending: boolean
  onChooseFile: (file: File | undefined) => void
  onError: (message: string) => void
  onUpload: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (isPending) return
    if (event.dataTransfer.files.length !== 1) {
      onError('Please choose one image at a time.')
      return
    }
    onChooseFile(event.dataTransfer.files[0])
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onUpload()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!isPending) setDragging(true)
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
          disabled={isPending}
          onChange={(event) => onChooseFile(event.currentTarget.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          disabled={isPending}
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
      <Button type="submit" className="mt-4" disabled={!file || isPending}>
        {isPending ? 'Uploading…' : 'Upload image'}
      </Button>
    </form>
  )
}
