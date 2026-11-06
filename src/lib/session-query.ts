import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { getSession, isAdmin } from '@/server/auth/session'

/**
 * Resolves the current request's user on the server for the home route.
 * The session itself is not sent to the browser; the response is marked private.
 * @returns The user's ID, name, email and admin flag, or null without a session.
 */
const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const session = await getSession()
  const user = session?.user
  return user
    ? { id: user.id, name: user.name, email: user.email, isAdmin: isAdmin(user.role) }
    : null
})

/**
 * Creates shared query options for SSR and client-side session revalidation.
 * The short freshness window avoids a second request immediately after hydration;
 * returning focus always revalidates the user.
 * @returns Query options for the current request's user.
 */
export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: ['current-user'],
    queryFn: ({ signal }) => getCurrentUser({ signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    retry: false,
  })
}
