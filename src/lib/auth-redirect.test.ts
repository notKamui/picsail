import { describe, expect, it } from 'vite-plus/test'
import { safeAuthRedirect } from './auth-redirect'

describe('safeAuthRedirect', () => {
  it('preserves local paths, search and hash', () => {
    expect(safeAuthRedirect('/upload?source=library#picker')).toBe('/upload?source=library#picker')
  })

  it('rejects external, protocol-relative and malformed redirects', () => {
    for (const value of [
      undefined,
      '',
      'https://example.com',
      '//example.com',
      String.raw`/\example.com`,
      '/\n/example.com',
    ]) {
      expect(safeAuthRedirect(value)).toBe('/files')
    }
  })
})
