import { describe, expect, it } from 'vite-plus/test'
import { imageExtension, isSupportedImageMime, normalizeMime } from './image-processing'

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
