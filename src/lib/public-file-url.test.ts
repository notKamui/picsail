import { describe, expect, it } from 'vite-plus/test'
import { publicFilePath, thumbnailFilePath } from './public-file-url'

describe('thumbnailFilePath', () => {
  it('uses the cached resize route for still images', () => {
    expect(thumbnailFilePath('abc123', 'png')).toBe('/f/320/abc123.png')
    expect(thumbnailFilePath('abc123', 'webp')).toBe('/f/320/abc123.webp')
  })

  it('uses the original for GIFs whose resize is not supported', () => {
    expect(thumbnailFilePath('abc123', 'gif')).toBe(publicFilePath('abc123', 'gif'))
    expect(thumbnailFilePath('abc123', 'GIF')).toBe('/f/abc123.GIF')
  })
})
