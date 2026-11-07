import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect, useMatchRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SidebarInset, SidebarProvider, useSidebarPreference } from '@/components/ui/sidebar'
import { currentUserQueryOptions } from '@/lib/session-query'
import { WorkspaceHeader } from './-workspace-header'
import { WorkspaceSidebar } from './-workspace-sidebar'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.query({ ...currentUserQueryOptions(), staleTime: 0 })
    if (!user) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    return { user }
  },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { data: user, error, isPending } = useQuery(currentUserQueryOptions())
  const router = useRouter()
  useEffect(() => {
    if (!isPending && !error && !user) void router.invalidate()
  }, [user, error, isPending, router])
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p role="alert" className="text-sm text-destructive">
          Could not verify your session. Please refresh the page.
        </p>
      </main>
    )
  }
  if (!user) {
    return (
      <output className="block px-5 py-16 text-sm text-muted-foreground">
        Loading your session…
      </output>
    )
  }
  return <AuthenticatedWorkspace user={user} />
}

function AuthenticatedWorkspace({
  user,
}: {
  user: { id: string; name: string; email: string; isAdmin: boolean }
}) {
  const matchRoute = useMatchRoute()
  const active = matchRoute({ to: '/admin', fuzzy: true })
    ? 'admin'
    : matchRoute({ to: '/upload', fuzzy: true })
      ? 'upload'
      : 'files'
  const { open, setOpen } = useSidebarPreference()

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <WorkspaceSidebar active={active} isAdmin={user.isAdmin} />
      <SidebarInset className="min-w-0">
        <WorkspaceHeader user={user} active={active} />
        <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
