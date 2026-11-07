import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UploadWorkspace } from '@/components/upload-workspace'
import { authClient } from '@/lib/auth-client'
import { personalFilesQueryOptions } from '@/lib/file-list-query'
import { orpc } from '@/lib/orpc'
import { currentUserQueryOptions } from '@/lib/session-query'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Picsail' }] }),
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({ ...currentUserQueryOptions(), staleTime: 0 })
    return { user }
  },
  loader: async ({ context }) => {
    if (!context.user) return
    const [error] = await tryAsync(
      context.queryClient.query(personalFilesQueryOptions(context.user.id, 1)),
    )
    if (error) console.error('Could not preload personal files:', error)
  },
  component: Home,
})

function Home() {
  const { data: user, isPending, error } = useQuery(currentUserQueryOptions())
  const queryClient = useQueryClient()
  const router = useRouter()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  /** Ends the current browser session and removes cached file data on success. */
  async function signOut() {
    setSigningOut(true)
    setSignOutError(null)
    const [requestError, result] = await tryAsync(authClient.signOut())
    setSigningOut(false)
    if (requestError || result.error) {
      setSignOutError('Could not sign out. Please try again.')
      return
    }
    queryClient.setQueryData(currentUserQueryOptions().queryKey, null)
    await queryClient.cancelQueries({ queryKey: orpc.files.list.key() })
    queryClient.removeQueries({ queryKey: orpc.files.list.key() })
    queryClient.removeQueries({ queryKey: orpc.files.getMetadata.key() })
    await queryClient.cancelQueries({ queryKey: orpc.admin.listFiles.key() })
    queryClient.removeQueries({ queryKey: orpc.admin.listFiles.key() })
    await router.invalidate()
  }

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-5 pb-20 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-border py-6">
        <Link to="/" className="font-serif text-2xl font-semibold tracking-tight">
          Picsail<span className="text-muted-foreground">.</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            {user.isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
              {user.name || user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
              <LogOut aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        ) : !isPending ? (
          <Button variant="outline" size="sm" asChild>
            <Link to="/sign-in">Sign in</Link>
          </Button>
        ) : null}
      </header>

      {signOutError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {signOutError}
        </p>
      )}
      {isPending ? (
        <output className="block py-16 text-sm text-muted-foreground">Loading your session…</output>
      ) : error ? (
        <p role="alert" className="py-16 text-sm text-destructive">
          Could not load your session. Please refresh the page.
        </p>
      ) : user ? (
        <UploadWorkspace key={user.id} userId={user.id} />
      ) : (
        <section className="mx-auto max-w-2xl py-20 sm:py-28">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Your images, your space
          </p>
          <h1 className="mt-5 max-w-xl font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            A quiet place for pictures.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Upload an image, share its link, and keep your files close at hand.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/sign-in">Sign in to upload</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/sign-up">Create an account</Link>
            </Button>
          </div>
        </section>
      )}
    </main>
  )
}
