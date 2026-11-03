import { createFileRoute } from '@tanstack/react-router'
import { getPublicFile } from '@/server/files/public'

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

        const file = await getPublicFile({
          id: match[1].toLowerCase(),
          extension: match[2].toLowerCase(),
        })
        if (!file) return new Response('Not Found', { status: 404 })

        return new Response(file.body, {
          headers: {
            'Content-Type': file.mime,
            'Content-Length': String(file.size),
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
