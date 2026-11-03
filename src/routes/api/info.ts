import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'
import { tryAsync } from '@/lib/try'
import { validateInput } from '@/lib/validate-input'
import { FileNotFoundError, getFileInfo } from '@/server/uploads'

const infoQuerySchema = z.object({
  hash: z.string().trim().min(1, 'Missing hash query parameter'),
})

export const Route = createFileRoute('/api/info')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const validation = validateInput(
          infoQuerySchema,
          { hash: url.searchParams.get('hash') },
          'Invalid info request',
        )

        if (!validation.success) return validation.response

        const [infoError, result] = await tryAsync(getFileInfo({ hash: validation.data.hash }), [
          FileNotFoundError,
        ])
        if (infoError) {
          return Response.json({ error: infoError.message }, { status: 404 })
        }

        return Response.json(result)
      },
    },
  },
})
