import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/f/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const segments = new URL(request.url).pathname.split('/').filter(Boolean)
        if (segments.length !== 2 || segments[0] !== 'f') {
          return new Response('Not Found', { status: 404 })
        }

        const match = /^([a-f0-9]{12})\.([a-z0-9]+)$/i.exec(segments[1])
        if (!match) return new Response('Not Found', { status: 404 })

        const id = match[1].toLowerCase()
        const extension = match[2].toLowerCase()
        return Response.redirect(new URL(`/api/files/${id}/content/${extension}`, request.url), 308)
      },
    },
  },
})
