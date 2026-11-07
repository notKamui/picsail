import { describe, expect, it } from 'vite-plus/test'
import { parseImageTransforms, parsePublicImageUrl } from './url-transform'

describe('public image URLs', () => {
  it('normalizes IDs and parses ordered resize modifiers', () => {
    expect(parsePublicImageUrl('/f/800x600/forcesize/ABCDEF123456.PNG')).toEqual({
      success: true,
      value: {
        id: 'abcdef123456',
        extension: 'png',
        transforms: [{ type: 'resize', width: 800, height: 600 }, { type: 'force-size' }],
      },
    })
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
