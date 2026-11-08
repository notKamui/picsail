import sharp from 'sharp'
import { describe, expect, it } from 'vite-plus/test'
import {
  calculateBlurhash,
  imageExtension,
  InvalidImageUploadError,
  isSupportedImageMime,
  normalizeMime,
  prepareStoredImageBytes,
} from './image-processing'

describe('supported image types', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
  ] as const)('accepts %s', (mime, extension) => {
    expect(isSupportedImageMime(mime)).toBe(true)
    expect(imageExtension(mime)).toBe(extension)
  })

  it.each(['image/svg+xml', 'constructor', '__proto__', 'toString', ''])(
    'rejects unsupported type %s',
    (mime) => {
      expect(isSupportedImageMime(mime)).toBe(false)
    },
  )

  it('normalizes MIME type casing and parameters', () => {
    expect(normalizeMime('IMAGE/JPEG;charset=utf-8')).toBe('image/jpeg')
  })
})

describe('uploaded image decoding', () => {
  it('rejects unsupported bytes with a stable invalid-image error', async () => {
    await expect(
      prepareStoredImageBytes(Buffer.from('not an image'), 'image/png'),
    ).rejects.toBeInstanceOf(InvalidImageUploadError)
  })

  it('rejects a truncated JPEG', async () => {
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer()

    await expect(
      prepareStoredImageBytes(image.subarray(0, 40), 'image/jpeg'),
    ).rejects.toBeInstanceOf(InvalidImageUploadError)
  })

  it('rejects a PNG with corrupt image data', async () => {
    const image = Buffer.from(
      await sharp({
        create: { width: 8, height: 8, channels: 3, background: 'red' },
      })
        .png()
        .toBuffer(),
    )
    const imageData = image.indexOf(Buffer.from('IDAT')) + 8
    image.writeUInt8((image.readUInt8(imageData) + 1) % 256, imageData)

    await expect(prepareStoredImageBytes(image, 'image/png')).rejects.toBeInstanceOf(
      InvalidImageUploadError,
    )
  })

  it('rejects malformed GIF data during placeholder generation', async () => {
    await expect(calculateBlurhash(Buffer.from('GIF89a'))).rejects.toBeInstanceOf(
      InvalidImageUploadError,
    )
  })

  it('continues to process valid image uploads', async () => {
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    const storedBytes = await prepareStoredImageBytes(image, 'image/png')

    expect(storedBytes.byteLength).toBeGreaterThan(0)
    await expect(calculateBlurhash(storedBytes)).resolves.toBeTruthy()
  })
})
