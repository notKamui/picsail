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

export function normalizeMime(mimeType: string) {
  return mimeType.toLowerCase().split(';', 1)[0] || 'application/octet-stream'
}

export function isSupportedImageMime(mimeType: string): mimeType is SupportedImageMime {
  return mimeType in extensionByMime
}

export function imageExtension(mimeType: SupportedImageMime) {
  return extensionByMime[mimeType]
}

export async function resizeImageBytes(imageBytes: Uint8Array, dimensions: ImageDimensions) {
  return Buffer.from(
    await sharp(Buffer.from(imageBytes))
      .resize(dimensions.width, dimensions.height, {
        fit: dimensions.fit ?? 'inside',
      })
      .toBuffer(),
  )
}

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
