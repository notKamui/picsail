import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'
import { tryAsync } from '@/lib/try'
import { validateInput } from '@/lib/validate-input'
import { deleteFile, FileNotFoundOrDeleteCodeMismatchError } from '@/server/files/delete'

const deleteFileSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{12}$/i),
  deleteCode: z
    .string()
    .toLowerCase()
    .regex(/^[a-f0-9]{24}$/),
})

const deleteCodeSchema = deleteFileSchema.pick({ deleteCode: true })

export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const [bodyError, body] = await tryAsync(request.json(), [SyntaxError])
        if (bodyError) {
          return Response.json({ error: 'Request must contain valid JSON' }, { status: 400 })
        }

        const bodyValidation = validateInput(deleteCodeSchema, body, 'Invalid delete request')
        if (!bodyValidation.success) return bodyValidation.response

        const validation = validateInput(
          deleteFileSchema,
          { id: params.id, deleteCode: bodyValidation.data.deleteCode },
          'Invalid delete request',
        )
        if (!validation.success) return validation.response

        const [deleteError] = await tryAsync(deleteFile(validation.data), [
          FileNotFoundOrDeleteCodeMismatchError,
        ])
        if (deleteError) {
          return Response.json({ error: deleteError.message }, { status: 404 })
        }

        return Response.json({ deleted: true })
      },
    },
  },
})
