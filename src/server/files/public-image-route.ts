import { ORPCError } from '@orpc/server'
import { tryAsync } from '@/lib/try'
import { getFileContentResponse } from './get-content.rpc'
import {
  parsePublicImageUrl,
  type ExecutableImageTransform,
  type ImageTransform,
} from './url-transform'

type TransformResolution =
  | { kind: 'transform'; transforms: ExecutableImageTransform[] }
  | { kind: 'unsupported' }

/**
 * Handles GET requests for public originals and transformed images. It parses the path,
 * dispatches to file serving, and maps known errors to HTTP responses; generating
 * a variant may read and write S3 and update the database cache catalog.
 * @param request - Incoming request whose URL supplies the file and modifiers.
 * @returns An image response, or a 400, 404, 415 or 501 response for known failures.
 * @throws Unexpected storage, database and processing errors.
 */
export async function handlePublicImageRequest(request: Request) {
  const parsedUrl = parsePublicImageUrl(new URL(request.url).pathname)
  if (!parsedUrl.success) {
    const status = parsedUrl.reason === 'not-found' ? 404 : 400
    return new Response(status === 404 ? 'Not Found' : 'Bad Request', { status })
  }

  const { id, extension, transforms } = parsedUrl.value
  const resolution = resolveTransforms(transforms)
  if (resolution.kind === 'unsupported') return new Response('Not Implemented', { status: 501 })
  const [error, result] = await tryAsync(
    getFileContentResponse({ id, extension }, resolution.transforms),
    [Error],
  )

  if (error) {
    if (error instanceof ORPCError && error.code === 'UNSUPPORTED_MEDIA_TYPE') {
      return new Response(error.message, { status: 415 })
    }
    if (error instanceof ORPCError && error.code === 'NOT_FOUND') {
      return new Response('Not Found', { status: 404 })
    }

    throw error
  }

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  })
}

/**
 * Selects what the public route can currently execute from parsed modifiers.
 * A fit modifier applies cover to the immediately preceding resize.
 * @param transforms - Parsed modifiers in URL order.
 * @returns An ordered transform sequence or unsupported resolution.
 */
function resolveTransforms(transforms: ImageTransform[]): TransformResolution {
  const operations: ExecutableImageTransform[] = []
  for (const transform of transforms) {
    switch (transform.type) {
      case 'resize': {
        operations.push({ ...transform, fit: 'inside' })
        break
      }
      case 'fit': {
        const previous = operations.at(-1)
        if (previous?.type !== 'resize') return { kind: 'unsupported' }
        previous.fit = 'cover'
        break
      }
      case 'rotate': {
        operations.push(transform)
        break
      }
      default: {
        return { kind: 'unsupported' }
      }
    }
  }
  return { kind: 'transform', transforms: operations }
}
