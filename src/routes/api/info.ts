import { createFileRoute } from '@tanstack/react-router'
import { handleInfoRequest } from '@/server/uploads'

export const Route = createFileRoute('/api/info')({
  server: {
    handlers: {
      GET: ({ request }) => handleInfoRequest(request),
    },
  },
})
