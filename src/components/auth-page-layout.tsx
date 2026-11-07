import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
          Picsail<span className="text-muted-foreground">.</span>
        </Link>
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back home
        </Link>
      </header>
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-16 md:grid-cols-2 md:gap-16">
        <div className="max-w-md">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Your images, your space
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Keep the pictures worth sharing close.
          </h1>
          <p className="mt-4 text-sm leading-7 text-pretty text-muted-foreground">
            Your library is ready when you are. Upload an image and share its public link.
          </p>
        </div>
        {children}
      </div>
    </main>
  )
}
