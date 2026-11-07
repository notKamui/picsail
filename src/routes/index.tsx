import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '@/components/landing-page'
import { currentUserQueryOptions } from '@/lib/session-query'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({ ...currentUserQueryOptions(), staleTime: 0 })
    if (user) throw redirect({ to: '/files' })
  },
  head: () => ({ meta: [{ title: 'Picsail' }] }),
  component: LandingPage,
})
