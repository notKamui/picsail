import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'
import { orpc } from '@/lib/orpc'
import { currentUserQueryOptions } from '@/lib/session-query'
import { tryAsync } from '@/lib/try'

export function WorkspaceHeader({
  user,
  active,
}: {
  user: { name: string; email: string }
  active: 'files' | 'upload' | 'admin'
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  /**
   * Ends the browser session, clears private query data, and refreshes route context.
   * @returns A promise resolving after navigation is refreshed or an error is displayed.
   */
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
    await router.navigate({ to: '/' })
    await router.invalidate()
  }

  return (
    <>
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <SidebarTrigger className="size-10" />
          <span className="hidden text-muted-foreground sm:inline">Workspace / </span>
          <span className="font-semibold">
            {active === 'admin' ? 'Administration' : active === 'upload' ? 'Upload' : 'My files'}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
            {user.name || user.email}
          </span>
          <Button variant="ghost" onClick={signOut} disabled={signingOut}>
            <LogOut aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </header>
      {signOutError && (
        <p role="alert" className="mx-5 mt-4 text-sm text-destructive sm:mx-8">
          {signOutError}
        </p>
      )}
    </>
  )
}
