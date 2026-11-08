import { OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins'
import { onError } from '@orpc/server'
import { ZodToJsonSchemaConverter } from '@orpc/zod'
import { createFileRoute } from '@tanstack/react-router'
import {
  createPublicApiCorsPlugin,
  createTmpFileUploadPlugin,
  normalizeFetchRequest,
} from '@/server/orpc/request'
import { router } from '@/server/orpc/router.gen'

const generator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
})

const handler = new OpenAPIHandler(router, {
  plugins: [
    createTmpFileUploadPlugin(),
    createPublicApiCorsPlugin(),
    new OpenAPIReferenceHandlerPlugin({
      spec: () =>
        generator.generate(router, {
          base: {
            info: {
              title: 'Picsail API',
              version: '1.0.0',
            },
            servers: [{ url: '/api' }],
          },
        }),
      docsPath: '/docs',
      specPath: '/openapi.json',
      docsTitle: 'Picsail API',
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { response } = await handler.handle(normalizeFetchRequest(request), {
          prefix: '/api',
        })

        return response ?? new Response('Not found', { status: 404 })
      },
    },
  },
})
