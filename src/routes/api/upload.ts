import { createFileRoute } from '@tanstack/react-router'
import { handleUploadRequest } from '@/server/uploads'

export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: ({ request }) => handleUploadRequest(request),
    },
  },
})
