import sharp from 'sharp'
import { describe, expect, it } from 'vite-plus/test'
import {
  calculateBlurhash,
  imageExtension,
  InvalidImageUploadError,
  isSupportedImageMime,
  normalizeMime,
  prepareStoredImageBytes,
  transformImageBytes,
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

describe('ordered image transformations', () => {
  it('applies resize and rotation in order, including repeated resizes', async () => {
    const image = await sharp({
      create: { width: 80, height: 40, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    const resizeThenRotate = await transformImageBytes(image, [
      { type: 'resize', width: 40, fit: 'inside' },
      { type: 'rotate', direction: 'right' },
    ])
    const rotateThenResize = await transformImageBytes(image, [
      { type: 'rotate', direction: 'right' },
      { type: 'resize', width: 40, fit: 'inside' },
    ])
    expect(await sharp(resizeThenRotate).metadata()).toMatchObject({ width: 20, height: 40 })
    expect(await sharp(rotateThenResize).metadata()).toMatchObject({ width: 40, height: 80 })

    const repeated = await transformImageBytes(image, [
      { type: 'resize', width: 40, height: 40, fit: 'cover' },
      { type: 'resize', width: 10, fit: 'inside' },
    ])
    expect(await sharp(repeated).metadata()).toMatchObject({ width: 10, height: 10 })
  })

  it('applies rotations in order to pixel positions', async () => {
    const image = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 2, height: 1, channels: 3 },
    })
      .png()
      .toBuffer()
    const rotated = await transformImageBytes(image, [
      { type: 'rotate', direction: 'right' },
      { type: 'rotate', direction: 'upside' },
    ])
    const { data, info } = await sharp(rotated).raw().toBuffer({ resolveWithObject: true })
    expect(info).toMatchObject({ width: 1, height: 2 })
    expect([...data]).toEqual([0, 0, 255, 255, 0, 0])
  })

  it.each([
    ['right', [255, 0, 0, 0, 0, 255]],
    ['left', [0, 0, 255, 255, 0, 0]],
  ] as const)('rotates %s in the expected direction', async (direction, expectedPixels) => {
    const image = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 2, height: 1, channels: 3 },
    })
      .png()
      .toBuffer()
    const rotated = await transformImageBytes(image, [{ type: 'rotate', direction }])
    const { data, info } = await sharp(rotated).raw().toBuffer({ resolveWithObject: true })
    expect(info).toMatchObject({ width: 1, height: 2 })
    expect([...data]).toEqual(expectedPixels)
  })

  it.each(['jpeg', 'png', 'webp', 'avif'] as const)(
    'converts to %s after resize',
    async (format) => {
      const image = await sharp({
        create: { width: 16, height: 8, channels: 3, background: 'red' },
      })
        .png()
        .toBuffer()
      const result = await transformImageBytes(
        image,
        [{ type: 'resize', width: 8, fit: 'inside' }],
        format,
      )
      const metadata = await sharp(result).metadata()
      expect(metadata).toMatchObject({
        width: 8,
        height: 4,
        format: format === 'avif' ? 'heif' : format,
      })
      if (format === 'avif') expect(metadata.compression).toBe('av1')
    },
  )
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
