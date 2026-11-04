import { createFileRoute } from '@tanstack/react-router'
import { handlePublicImageRequest } from '@/server/files/public-image-route'

export const Route = createFileRoute('/f/$')({
  server: {
    handlers: {
      GET: ({ request }) => handlePublicImageRequest(request),
    },
  },
})
