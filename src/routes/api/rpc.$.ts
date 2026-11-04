import { onError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { createFileRoute } from '@tanstack/react-router'
import { normalizeFetchRequest, uploadBodyLimitPlugin } from '@/server/orpc/body-limit'
import { router } from '@/server/orpc/router'

const handler = new RPCHandler(router, {
  plugins: [uploadBodyLimitPlugin],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const Route = createFileRoute('/api/rpc/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(normalizeFetchRequest(request), {
          prefix: '/api/rpc',
        })

        return response ?? new Response('Not found', { status: 404 })
      },
    },
  },
})
