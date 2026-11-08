import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createClientOnlyFn } from '@tanstack/react-start'
import type { router } from '@/server/orpc/router.gen'

/**
 * Creates a client-only oRPC client for direct procedure calls in the browser.
 * @returns A client bound to the generated application router.
 */
export const getClientORPCClient = createClientOnlyFn((): RouterClient<typeof router> =>
  createORPCClient(new RPCLink({ url: '/api/rpc' })),
)
