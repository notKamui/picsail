import { Link } from '@tanstack/react-router'
import { ArrowDownToLine, ArrowRight, Link2, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: Upload,
    number: '01',
    title: 'Upload images',
    description: 'Upload a JPEG, PNG, GIF or WebP to your own image library.',
  },
  {
    icon: Link2,
    number: '02',
    title: 'Share a link',
    description: 'Every image gets a public URL, ready to share wherever you need it.',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Stay in control',
    description: 'Browse your uploads and remove the ones you no longer need.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
          Picsail<span className="text-muted-foreground">.</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" asChild>
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/sign-up">
              Get started <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-12 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_0.95fr] lg:gap-20 lg:pt-24 lg:pb-28">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Your images, your space
            </p>
            <h1 className="mt-6 max-w-2xl font-serif text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              A quiet place for pictures.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
              Upload images to your own library and share them with a public link.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  Create an account <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sign-in">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              A self-hosted home for your images.
            </p>
          </div>
          <div
            className="landing-art relative flex aspect-[1.15] items-center justify-center overflow-hidden rounded-3xl p-8 sm:p-12"
            aria-hidden="true"
          >
            <div className="landing-art-orbit landing-art-orbit-one" />
            <div className="landing-art-orbit landing-art-orbit-two" />
            <div className="relative w-full max-w-sm rotate-[-4deg] rounded-2xl bg-card p-3 shadow-xl">
              <div className="landing-art-image flex aspect-[1.2] items-end overflow-hidden rounded-lg p-5">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold tracking-widest text-slate-800 uppercase">
                  Your library
                </span>
              </div>
              <div className="flex items-center justify-between px-1 pt-4 pb-1">
                <div>
                  <div className="h-2 w-24 rounded-full bg-foreground/70" />
                  <div className="mt-2 h-1.5 w-16 rounded-full bg-foreground/20" />
                </div>
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                  <ArrowDownToLine className="size-4" />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Simple by design
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                From your device to wherever you share.
              </h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-12">
              {features.map(({ icon: Icon, number, title, description }) => (
                <div key={number} className="border-t border-border pt-5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                    <span className="text-xs tabular-nums">{number}</span>
                  </div>
                  <h3 className="mt-6 font-serif text-xl font-semibold">{title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-pretty text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:px-8">
        <span className="font-serif text-lg font-semibold text-foreground">Picsail.</span>
        <span>Self-hosted image sharing.</span>
      </footer>
    </div>
  )
}
