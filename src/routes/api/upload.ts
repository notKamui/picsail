import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'
import { tryAsync } from '@/lib/try'
import { validateInput } from '@/lib/validate-input'
import { $$authed } from '@/server/$$authed'
import { uploadImage, UnsupportedUploadTypeError, UploadTooLargeError } from '@/server/uploads'

const uploadSchema = z.object({
  file: z.custom<File>((value) => value instanceof File, 'Multipart field "file" is required'),
})

export const Route = createFileRoute('/api/upload')({
  server: {
    middleware: [$$authed],
    handlers: {
      POST: async ({ request, context }) => {
        const [formDataError, formData] = await tryAsync(request.formData(), [TypeError])
        if (formDataError) {
          return Response.json(
            { error: 'Request must contain valid multipart form data' },
            { status: 400 },
          )
        }

        const validation = validateInput(
          uploadSchema,
          { file: formData.get('file') },
          'Invalid upload',
        )
        if (!validation.success) return validation.response

        const [uploadError, result] = await tryAsync(
          uploadImage({
            userId: context.userId,
            file: validation.data.file,
          }),
          [UnsupportedUploadTypeError, UploadTooLargeError],
        )
        if (uploadError) {
          const status = uploadError instanceof UploadTooLargeError ? 413 : 400
          return Response.json({ error: uploadError.message }, { status })
        }

        return Response.json(result)
      },
    },
  },
})
