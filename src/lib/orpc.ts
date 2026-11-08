import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getClientORPCClient } from '@/lib/orpc.client'
import { getServerORPCClient } from '@/lib/orpc.server'

const getORPCClient = createIsomorphicFn()
  .server(() => getServerORPCClient())
  .client(() => getClientORPCClient())

export const orpc = createTanstackQueryUtils(getORPCClient())
