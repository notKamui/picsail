import { ORPCError } from '@orpc/server'
import { createFileRoute } from '@tanstack/react-router'
import { tryAsync } from '@/lib/try'
import { getFileContentResponse } from '@/server/files/get-content.rpc'

export const Route = createFileRoute('/f/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const segments = new URL(request.url).pathname.split('/').filter(Boolean)
        if (segments.length !== 2 || segments[0] !== 'f') {
          return new Response('Not Found', { status: 404 })
        }

        const match = /^([a-f0-9]{12})\.([a-z0-9]+)$/i.exec(segments[1])
        if (!match) return new Response('Not Found', { status: 404 })

        const [error, result] = await tryAsync(
          getFileContentResponse({
            id: match[1].toLowerCase(),
            extension: match[2].toLowerCase(),
          }),
          [ORPCError],
        )

        if (error) {
          if (error.code === 'NOT_FOUND') return new Response('Not Found', { status: 404 })

          throw error
        }

        return new Response(result.body, {
          status: result.status,
          headers: result.headers,
        })
      },
    },
  },
})
