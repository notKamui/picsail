import { encode as encodeBH } from 'blurhash'
import sharp from 'sharp'
import type { ExecutableImageTransform } from './url-transform'

const extensionByMime = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
} as const

export type SupportedImageMime = keyof typeof extensionByMime
export type ImageOutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export class InvalidImageUploadError extends Error {
  constructor() {
    super('This file is not a valid image. Choose a valid JPEG, PNG, GIF or WebP file.')
    this.name = 'InvalidImageUploadError'
  }
}

/**
 * Normalizes an upload's declared MIME type before checking supported formats.
 * @param mimeType - MIME header or file type, possibly with parameters.
 * @returns Lowercase media type without parameters, or application/octet-stream if empty.
 */
export function normalizeMime(mimeType: string) {
  return mimeType.toLowerCase().split(';', 1)[0] || 'application/octet-stream'
}

/**
 * Checks whether the declared upload MIME type is in the image format mapping.
 * @param mimeType - Normalized media type to check; image bytes are not inspected.
 * @returns True for a supported type and narrows its TypeScript type.
 */
export function isSupportedImageMime(mimeType: string): mimeType is SupportedImageMime {
  return Object.hasOwn(extensionByMime, mimeType)
}

/**
 * Selects the public filename extension for a supported uploaded image type.
 * @param mimeType - Supported, normalized image MIME type.
 * @returns Its canonical extension without a leading dot.
 */
export function imageExtension(mimeType: SupportedImageMime) {
  return extensionByMime[mimeType]
}

/**
 * Generates a variant by executing each operation in URL order.
 * @param imageBytes - Encoded source image, loaded into memory.
 * @param transforms - Ordered operations with resize fit already resolved.
 * @param outputFormat - Optional conversion performed after the ordered operations.
 * @returns Encoded image bytes; Sharp decoding/encoding errors propagate.
 */
export async function transformImageBytes(
  imageBytes: Uint8Array,
  transforms: ExecutableImageTransform[],
  outputFormat?: ImageOutputFormat,
) {
  let bytes = Buffer.from(imageBytes)
  for (const transform of transforms) {
    const image = sharp(bytes)
    switch (transform.type) {
      case 'resize': {
        bytes = await image
          .resize(transform.width, transform.height, { fit: transform.fit })
          .toBuffer()
        break
      }
      case 'rotate': {
        bytes = await image
          .rotate(transform.direction === 'left' ? 270 : transform.direction === 'right' ? 90 : 180)
          .toBuffer()
        break
      }
    }
  }
  return outputFormat ? sharp(bytes).toFormat(outputFormat).toBuffer() : bytes
}

/**
 * Prepares upload bytes for hashing and storage. GIF bytes are preserved; other
 * supported types are decoded, auto-oriented and re-encoded without metadata.
 * Decoder failures for invalid input throw InvalidImageUploadError.
 * @param sourceBytes - Entire uploaded image.
 * @param mimeType - Normalized declared image MIME type.
 * @returns Stored bytes, or the original input for GIF; unexpected errors propagate.
 */
export async function prepareStoredImageBytes(sourceBytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/gif') {
    return sourceBytes
  }

  const outputFormat =
    mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpeg'
  return processUploadedImage(() =>
    sharp(Buffer.from(sourceBytes))
      .rotate()
      .toFormat(outputFormat, {
        quality: 92,
        compressionLevel: 9,
      })
      .toBuffer(),
  )
}

/**
 * Computes the placeholder stored with a blob during upload.
 * @param imageBytes - Encoded image bytes to decode and downscale in memory.
 * @returns A 4-by-4 component BlurHash string; invalid images throw InvalidImageUploadError.
 */
export async function calculateBlurhash(imageBytes: Uint8Array) {
  return processUploadedImage(async () => {
    const { data, info } = await sharp(Buffer.from(imageBytes))
      .rotate()
      .resize(32, 32, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return encodeBH(new Uint8ClampedArray(data), info.width, info.height, 4, 4)
  })
}

async function processUploadedImage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (isImageDecoderInputError(error)) {
      throw new InvalidImageUploadError()
    }

    throw error
  }
}

function isImageDecoderInputError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false

  return (
    /^Input buffer (?:contains unsupported image format|has corrupt header)/i.test(error.message) ||
    /^(?:Vips(?:Jpeg|Png|Webp|Gif)|vips(?:jpeg|png|webp|gif)|(?:jpeg|png|webp|gif)load(?:_buffer)?):.*(?:read error|corrupt|invalid|unsupported|unexpected|premature|no image|parse|truncated|end of)/i.test(
      error.message,
    )
  )
}
