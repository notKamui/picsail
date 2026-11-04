import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { createFileRoute } from '@tanstack/react-router'
import { router } from '@/server/orpc/router'

const handler = new OpenAPIHandler(router, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: 'Picsail API',
          version: '1.0.0',
        },
        servers: [{ url: '/api/openapi' }],
      },
      docsPath: '/docs',
      specPath: '/spec.json',
      docsTitle: 'Picsail API',
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const Route = createFileRoute('/api/openapi/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(request, {
          prefix: '/api/openapi',
        })

        return response ?? new Response('Not found', { status: 404 })
      },
    },
  },
})
