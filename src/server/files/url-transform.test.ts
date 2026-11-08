import { describe, expect, it } from 'vite-plus/test'
import { parseImageTransforms, parsePublicImageUrl } from './url-transform'

describe('public image URLs', () => {
  it('normalizes IDs and parses ordered resize modifiers', () => {
    expect(parsePublicImageUrl('/f/800x600/fit/ABCDEF123456.PNG')).toEqual({
      success: true,
      value: {
        id: 'abcdef123456',
        extension: 'png',
        transforms: [{ type: 'resize', width: 800, height: 600 }, { type: 'fit' }],
      },
    })
  })

  it('accepts rotation and repeated resizes in order', () => {
    expect(parseImageTransforms(['100x50', 'fit', 'right', '20'])).toEqual({
      success: true,
      value: [
        { type: 'resize', width: 100, height: 50 },
        { type: 'fit' },
        { type: 'rotate', direction: 'right' },
        { type: 'resize', width: 20, height: undefined },
      ],
    })
  })

  it.each(['webp', 'avif'])('rejects format segment %s', (token) => {
    expect(parseImageTransforms([token])).toEqual({ success: false })
  })

  it.each([[['fit']], [['forcesize']], [['100', 'right', 'fit']], [['100', 'fit', 'fit']]])(
    'rejects invalid or obsolete fit usage %j',
    (tokens) => {
      expect(parseImageTransforms(tokens)).toEqual({ success: false })
    },
  )

  it('limits the number of transformations', () => {
    expect(parseImageTransforms(Array.from({ length: 16 }, () => 'right')).success).toBe(true)
    expect(parseImageTransforms(Array.from({ length: 17 }, () => 'right')).success).toBe(false)
  })

  it.each(['0', '4097', 'x0', '4096x4097', '99999999999999999999', 'x'])(
    'rejects invalid dimensions %s',
    (token) => {
      expect(parseImageTransforms([token])).toEqual({ success: false })
    },
  )

  it('accepts the dimension limit and height-only requests', () => {
    expect(parseImageTransforms(['4096', 'x600'])).toEqual({
      success: true,
      value: [
        { type: 'resize', width: 4096, height: undefined },
        { type: 'resize', width: undefined, height: 600 },
      ],
    })
  })

  it('distinguishes invalid transforms from missing file paths', () => {
    expect(parsePublicImageUrl('/f/unknown/abcdef123456.png')).toEqual({
      success: false,
      reason: 'bad-request',
    })
    expect(parsePublicImageUrl('/f/not-an-id.png')).toEqual({
      success: false,
      reason: 'not-found',
    })
  })
})
