import { ORPCError } from '@orpc/server'
import { tryAsync } from '@/lib/try'
import {
  getFileContentResponse,
  getTransformedFileContentResponse,
  UnsupportedImageTransformError,
} from './get-content.rpc'
import type { ImageDimensions } from './image-processing'
import { parsePublicImageUrl, type ImageTransform } from './url-transform'

type TransformResolution =
  | { kind: 'original' }
  | { kind: 'resize'; dimensions: ImageDimensions }
  | { kind: 'invalid' }
  | { kind: 'unsupported' }

/**
 * Handles GET requests for public originals and resized images. It parses the path,
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
  if (resolution.kind === 'invalid') return new Response('Bad Request', { status: 400 })

  const [error, result] = await tryAsync(
    resolution.kind === 'resize'
      ? getTransformedFileContentResponse({ id, extension }, resolution.dimensions)
      : getFileContentResponse({ id, extension }),
    [Error],
  )

  if (error) {
    if (error instanceof UnsupportedImageTransformError) {
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
 * For multiple resize tokens, the last size wins; force-size selects cover fit.
 * @param transforms - Parsed modifiers in URL order.
 * @returns An original, resize, invalid or unsupported resolution.
 */
function resolveTransforms(transforms: ImageTransform[]): TransformResolution {
  if (transforms.length === 0) return { kind: 'original' }

  if (
    transforms.some((transform) => transform.type !== 'resize' && transform.type !== 'force-size')
  ) {
    return { kind: 'unsupported' }
  }

  const resizeTransforms = transforms.filter((transform) => transform.type === 'resize')
  const forceSize = transforms.some((transform) => transform.type === 'force-size')
  if (forceSize && resizeTransforms.length === 0) return { kind: 'invalid' }

  const resize = resizeTransforms.at(-1)
  if (!resize || resize.type !== 'resize') return { kind: 'invalid' }

  return {
    kind: 'resize',
    dimensions: {
      width: resize.width,
      height: resize.height,
      fit: forceSize ? 'cover' : 'inside',
    },
  }
}
