import { createRouterClient } from '@orpc/server'
import { createServerOnlyFn } from '@tanstack/react-start'
import { router } from '@/server/orpc/router.gen'

/**
 * Creates a server-only oRPC client for direct procedure calls during SSR.
 * @returns A client bound to the generated application router.
 */
export const getServerOrpcClient = createServerOnlyFn(() => createRouterClient(router))
