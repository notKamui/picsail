import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { currentUserQueryOptions } from '@/lib/session-query'

export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query({ ...currentUserQueryOptions(), staleTime: 0 })
    if (user) throw redirect({ to: '/files' })
  },
  component: Outlet,
})
