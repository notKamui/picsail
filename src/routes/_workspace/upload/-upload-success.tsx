import { Link } from '@tanstack/react-router'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyLink } from '@/lib/copy-link'

export function UploadSuccess({ url, onReset }: { url: string; onReset: () => void }) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6">
      <output className="sr-only">Image uploaded successfully.</output>
      <h2 className="font-serif text-2xl font-semibold">Your image is ready.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Share this public link wherever you like.
      </p>
      <a href={url} className="mt-4 block text-sm break-all underline underline-offset-4">
        {url}
      </a>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={async () => setCopyMessage(await copyLink(url))}>
          <Copy aria-hidden="true" /> Copy link
        </Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Upload another
        </Button>
        <Button asChild variant="ghost">
          <Link to="/files">View my files</Link>
        </Button>
      </div>
      {copyMessage && <output className="mt-3 block text-sm">{copyMessage}</output>}
    </div>
  )
}
