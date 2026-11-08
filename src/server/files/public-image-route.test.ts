import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const state = vi.hoisted(() => ({
  source: new Uint8Array(),
  mime: 'image/png',
  extension: 'png',
  cache: new Map<string, { bytes: Uint8Array; mime: string }>(),
  opens: 0,
  sourceMissing: false,
}))

vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () =>
            Promise.resolve([
              {
                sha256: 'a'.repeat(64),
                mime: state.mime,
                extension: state.extension,
                byteSize: state.source.byteLength,
              },
            ]),
        }),
      }),
    }),
  },
  takeUniqueOrNull: <T>(rows: T[]) => rows[0] ?? null,
}))

vi.mock('@/server/storage', () => ({
  storage: {
    open: async () => {
      state.opens++
      if (state.sourceMissing) return null
      return { body: new Response(state.source).body }
    },
  },
}))

vi.mock('./variant-cache', () => ({
  openCachedVariant: async (key: string) => {
    const entry = state.cache.get(key)
    if (!entry) return null
    return {
      body: new Response(Uint8Array.from(entry.bytes)).body,
      contentLength: entry.bytes.byteLength,
    }
  },
  storeCachedVariant: async (key: string, _sha256: string, bytes: Uint8Array, mime: string) => {
    state.cache.set(key, { bytes, mime })
  },
}))

import { handlePublicImageRequest } from './public-image-route'

describe('public image transformation route', () => {
  beforeEach(async () => {
    state.source = await sharp({
      create: { width: 80, height: 40, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    state.mime = 'image/png'
    state.extension = 'png'
    state.cache.clear()
    state.opens = 0
    state.sourceMissing = false
  })

  it('serves ordered transformations with the correct MIME and reuses their cache', async () => {
    const url = 'http://localhost/f/20x20/fit/right/abcdef123456.webp'
    const first = await handlePublicImageRequest(new Request(url))
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toBe('image/webp')
    const firstBytes = await first.arrayBuffer()
    expect(await sharp(Buffer.from(firstBytes)).metadata()).toMatchObject({
      format: 'webp',
      width: 20,
      height: 20,
    })
    expect([...state.cache.values()][0].mime).toBe('image/webp')
    expect(state.opens).toBe(1)

    const second = await handlePublicImageRequest(new Request(url))
    expect(second.headers.get('content-type')).toBe('image/webp')
    expect(await second.arrayBuffer()).toEqual(firstBytes)
    expect(state.opens).toBe(1)

    const reordered = await handlePublicImageRequest(
      new Request('http://localhost/f/right/20x20/fit/abcdef123456.webp'),
    )
    expect(reordered.status).toBe(200)
    expect(state.opens).toBe(2)
    expect(state.cache.size).toBe(2)
  })

  it('reports the final converted format when served from cache', async () => {
    const url = 'http://localhost/f/10/abcdef123456.avif'
    const first = await handlePublicImageRequest(new Request(url))
    expect(first.headers.get('content-type')).toBe('image/avif')
    expect(await sharp(Buffer.from(await first.arrayBuffer())).metadata()).toMatchObject({
      format: 'heif',
      compression: 'av1',
      width: 10,
      height: 5,
    })
    const second = await handlePublicImageRequest(new Request(url))
    expect(second.headers.get('content-type')).toBe('image/avif')
    expect(state.opens).toBe(1)
  })

  it.each([
    ['jpeg', 'jpg', 'png', 'image/png', 'png'],
    ['png', 'png', 'jpg', 'image/jpeg', 'jpeg'],
    ['webp', 'webp', 'jpeg', 'image/jpeg', 'jpeg'],
    ['webp', 'webp', 'png', 'image/png', 'png'],
    ['png', 'png', 'webp', 'image/webp', 'webp'],
    ['png', 'png', 'avif', 'image/avif', 'heif'],
  ] as const)(
    'converts original %s to requested %s -> %s',
    async (sourceFormat, sourceExtension, targetExtension, mime, decodedFormat) => {
      state.source = await sharp(state.source).toFormat(sourceFormat).toBuffer()
      state.extension = sourceExtension
      state.mime = `image/${sourceFormat}`
      const response = await handlePublicImageRequest(
        new Request(`http://localhost/f/abcdef123456.${targetExtension}`),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe(mime)
      const bytes = Buffer.from(await response.arrayBuffer())
      expect(await sharp(bytes).metadata()).toMatchObject({ format: decodedFormat })
      const cached = await handlePublicImageRequest(
        new Request(`http://localhost/f/abcdef123456.${targetExtension}`),
      )
      expect(cached.headers.get('content-type')).toBe(mime)
      expect(Buffer.from(await cached.arrayBuffer())).toEqual(bytes)
      expect(state.opens).toBe(1)
    },
  )

  it('serves original bytes directly and separates output formats in the cache', async () => {
    const original = await handlePublicImageRequest(
      new Request('http://localhost/f/abcdef123456.png'),
    )
    expect(Buffer.from(await original.arrayBuffer())).toEqual(Buffer.from(state.source))
    expect(state.cache.size).toBe(0)
    for (const extension of ['webp', 'jpg', 'avif']) {
      const response = await handlePublicImageRequest(
        new Request(`http://localhost/f/10/abcdef123456.${extension}`),
      )
      expect(response.status).toBe(200)
    }
    expect(state.cache.size).toBe(3)
  })

  it('supports jpg and jpeg aliases without re-encoding a JPEG original', async () => {
    state.source = await sharp(state.source).jpeg().toBuffer()
    state.mime = 'image/jpeg'
    state.extension = 'jpg'
    const response = await handlePublicImageRequest(
      new Request('http://localhost/f/abcdef123456.jpeg'),
    )
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(state.source))
    expect(state.cache.size).toBe(0)
  })

  it('shares cached JPEG variants between jpg and jpeg extensions', async () => {
    const jpg = await handlePublicImageRequest(
      new Request('http://localhost/f/10/abcdef123456.jpg'),
    )
    const jpeg = await handlePublicImageRequest(
      new Request('http://localhost/f/10/abcdef123456.jpeg'),
    )
    expect(jpg.headers.get('content-type')).toBe('image/jpeg')
    expect(jpeg.headers.get('content-type')).toBe('image/jpeg')
    expect(await jpg.arrayBuffer()).toEqual(await jpeg.arrayBuffer())
    expect(state.opens).toBe(1)
    expect(state.cache.size).toBe(1)
  })

  it.each(['png', 'webp'])('returns 404 when the original is missing for %s', async (extension) => {
    state.sourceMissing = true
    const response = await handlePublicImageRequest(
      new Request(`http://localhost/f/abcdef123456.${extension}`),
    )
    expect(response.status).toBe(404)
    expect(state.cache.size).toBe(0)
  })

  it('returns 404 for an unknown output extension', async () => {
    const response = await handlePublicImageRequest(
      new Request('http://localhost/f/abcdef123456.xyz'),
    )
    expect(response.status).toBe(404)
  })

  it('rejects invalid modifiers and leaves deferred transforms unsupported', async () => {
    for (const token of ['fit', 'forcesize', 'webp', 'avif']) {
      const response = await handlePublicImageRequest(
        new Request(`http://localhost/f/${token}/abcdef123456.png`),
      )
      expect(response.status).toBe(400)
    }
    const filterResponse = await handlePublicImageRequest(
      new Request('http://localhost/f/sepia/abcdef123456.png'),
    )
    expect(filterResponse.status).toBe(501)
    state.mime = 'image/gif'
    state.extension = 'gif'
    const gifResponse = await handlePublicImageRequest(
      new Request('http://localhost/f/right/abcdef123456.gif'),
    )
    expect(gifResponse.status).toBe(415)
    expect(await gifResponse.text()).toBe('GIF transformations are not supported')
    const gifConversion = await handlePublicImageRequest(
      new Request('http://localhost/f/abcdef123456.webp'),
    )
    expect(gifConversion.status).toBe(415)
  })
})
