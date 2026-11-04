import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getServerOrpcClient } from '@/lib/orpc.server'
import type { router } from '@/server/orpc/router'

const getClient = createIsomorphicFn()
  .server((): RouterClient<typeof router> => getServerOrpcClient())
  .client(() =>
    createORPCClient<RouterClient<typeof router>>(
      new RPCLink({
        url: () => new URL('/api/rpc', window.location.origin),
      }),
    ),
  )

export const orpc = createTanstackQueryUtils(getClient())
