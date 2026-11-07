import { useCallback, useMemo, useSyncExternalStore } from 'react'

const COOKIE_CHANGE_EVENT = 'picsail:cookie-change'
const COOKIE_SYNC_KEY = 'picsail:cookie-sync'

type CookieOptions = {
  maxAge?: number
  path?: string
  sameSite?: 'Strict' | 'Lax' | 'None'
  secure?: boolean
}

export function readCookie(cookies: string, name: string) {
  const prefix = `${encodeURIComponent(name)}=`
  const entry = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return entry === undefined ? undefined : decodeURIComponent(entry.slice(prefix.length))
}

export function serializeCookie(name: string, value: string, options: CookieOptions) {
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    options.maxAge === undefined ? undefined : `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite ?? 'Lax'}`,
    options.secure ? 'Secure' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join('; ')
}

function subscribeToCookies(onChange: () => void) {
  window.addEventListener(COOKIE_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(COOKIE_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * The server value must match the cookie value rendered on the server.
 * Deserializers should return immutable values and report invalid input.
 */
export function useCookie<T>(
  name: string,
  serverValue: T | undefined,
  {
    serialize,
    deserialize,
    maxAge,
    path,
    sameSite,
    secure,
  }: CookieOptions & {
    serialize: (value: T) => string
    deserialize: (value: string) => T
  },
) {
  const getSnapshot = useCallback(() => readCookie(document.cookie, name), [name])
  const getServerSnapshot = useCallback(
    () => (serverValue === undefined ? undefined : serialize(serverValue)),
    [serverValue, serialize],
  )
  const rawValue = useSyncExternalStore(subscribeToCookies, getSnapshot, getServerSnapshot)
  const value = useMemo(
    () => (rawValue === undefined ? undefined : deserialize(rawValue)),
    [rawValue, deserialize],
  )

  const setValue = useCallback(
    (nextValue: T) => {
      const serialized = serialize(nextValue)
      // oxlint-disable-next-line unicorn/no-document-cookie
      document.cookie = serializeCookie(name, serialized, {
        maxAge,
        path,
        sameSite,
        secure: secure ?? location.protocol === 'https:',
      })
      window.dispatchEvent(new Event(COOKIE_CHANGE_EVENT))
      try {
        localStorage.setItem(COOKIE_SYNC_KEY, `${Date.now()}-${Math.random()}`)
      } catch (error) {
        console.error('Could not synchronize cookie across tabs:', error)
      }
    },
    [name, maxAge, path, sameSite, secure, serialize],
  )

  return [value, setValue] as const
}
