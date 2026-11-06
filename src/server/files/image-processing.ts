import { encode as encodeBH } from 'blurhash'
import sharp from 'sharp'

const extensionByMime = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
} as const

export type SupportedImageMime = keyof typeof extensionByMime

export type ImageDimensions = {
  width?: number
  height?: number
  fit?: 'inside' | 'cover'
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
  return mimeType in extensionByMime
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
 * Generates a variant for public image serving using Sharp.
 * @param imageBytes - Encoded source image, loaded into memory.
 * @param dimensions - Requested width, height and optional fit (defaults to inside).
 * @returns Encoded resized image bytes; Sharp decoding/encoding errors propagate.
 */
export async function resizeImageBytes(imageBytes: Uint8Array, dimensions: ImageDimensions) {
  return Buffer.from(
    await sharp(Buffer.from(imageBytes))
      .resize(dimensions.width, dimensions.height, {
        fit: dimensions.fit ?? 'inside',
      })
      .toBuffer(),
  )
}

/**
 * Prepares upload bytes for hashing and storage. GIF bytes are preserved; other
 * supported types are decoded, auto-oriented and re-encoded without metadata.
 * @param sourceBytes - Entire uploaded image.
 * @param mimeType - Normalized declared image MIME type.
 * @returns Stored bytes, or the original input for GIF; Sharp errors propagate.
 */
export async function prepareStoredImageBytes(sourceBytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/gif') {
    return sourceBytes
  }

  const outputFormat =
    mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpeg'
  return Buffer.from(
    await sharp(Buffer.from(sourceBytes))
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
 * @returns A 4-by-4 component BlurHash string; decoding errors propagate.
 */
export async function calculateBlurhash(imageBytes: Uint8Array) {
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
}
