import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { copyLink } from './copy-link'

afterEach(() => vi.unstubAllGlobals())

describe('copyLink', () => {
  it('copies the supplied URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyLink('https://example.test/image.png')).toBe('Link copied.')
    expect(writeText).toHaveBeenCalledWith('https://example.test/image.png')
  })

  it('reports an unavailable clipboard', async () => {
    vi.stubGlobal('navigator', {})
    expect(await copyLink('https://example.test/image.png')).toBe(
      'Clipboard unavailable. Select the link above to copy it.',
    )
  })

  it('reports a rejected copy', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    expect(await copyLink('https://example.test/image.png')).toBe(
      'Could not copy the link. Select it above to copy it.',
    )
  })
})
