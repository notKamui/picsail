import { createRouterClient, type RouterClient } from '@orpc/server'
import { createServerOnlyFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { router } from '@/server/orpc/router.gen'

/**
 * Creates a server-only oRPC client for direct procedure calls during SSR.
 * @returns A client bound to the generated application router.
 */
export const getServerORPCClient = createServerOnlyFn((): RouterClient<typeof router> =>
  createRouterClient(router, {
    context: () => ({
      headers: getRequestHeaders(),
    }),
  }),
)
