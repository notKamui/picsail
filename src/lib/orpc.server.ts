import { createRouterClient } from '@orpc/server'
import { createServerOnlyFn } from '@tanstack/react-start'
import { router } from '@/server/orpc/router'

export const getServerOrpcClient = createServerOnlyFn(() => createRouterClient(router))
