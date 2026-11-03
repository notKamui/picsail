import { createMiddleware } from '@tanstack/react-start'
import { getSession } from '@/server/session'

export const $$authed = createMiddleware().server(async ({ next }) => {
  const session = await getSession()
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return next({
    context: {
      userId: session.user.id,
    },
  })
})
