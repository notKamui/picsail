import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { readCookie, serializeCookie, useCookie } from './use-cookie'

function TestCookie({ initial }: { initial: boolean | undefined }) {
  const [value] = useCookie('preference', initial, {
    serialize: String,
    deserialize: (raw) => raw === 'true',
  })
  return createElement('span', null, value === undefined ? 'missing' : String(value))
}

describe('cookie helpers', () => {
  it('reads exact names and decodes values', () => {
    expect(readCookie('other=one; my%20cookie=hello%3B%20world; last=two', 'my cookie')).toBe(
      'hello; world',
    )
    expect(readCookie('sidebar_extra=false; sidebar=', 'sidebar')).toBe('')
    expect(readCookie('sidebar_extra=false', 'sidebar')).toBeUndefined()
  })

  describe('useCookie', () => {
    it('uses the typed server value and strict boolean deserialization during SSR', () => {
      expect(renderToString(createElement(TestCookie, { initial: false }))).toBe(
        '<span>false</span>',
      )
    })

    it('preserves an absent server value', () => {
      expect(renderToString(createElement(TestCookie, { initial: undefined }))).toBe(
        '<span>missing</span>',
      )
    })
  })

  it('encodes values and supports cookie attributes', () => {
    expect(serializeCookie('my cookie', 'hello; world', {})).toBe(
      'my%20cookie=hello%3B%20world; Path=/; SameSite=Lax',
    )
    expect(
      serializeCookie('preference', 'false', {
        path: '/app',
        maxAge: 60,
        sameSite: 'Strict',
        secure: true,
      }),
    ).toBe('preference=false; Path=/app; Max-Age=60; SameSite=Strict; Secure')
  })
})
