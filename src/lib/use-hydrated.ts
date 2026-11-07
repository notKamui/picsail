import { useSyncExternalStore } from 'react'

/** Provides the stable no-op subscription required for hydration detection. */
function subscribe() {
  return () => {}
}

/**
 * Indicates whether browser hydration has completed, allowing locale-sensitive
 * values to use the same initial markup on the server and in the browser.
 * @returns False during SSR and hydration, true once the client is ready.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
