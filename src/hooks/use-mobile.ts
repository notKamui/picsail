import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Subscribes to viewport breakpoint changes for the responsive sidebar. */
function subscribe(onChange: () => void) {
  const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Reads the current viewport breakpoint in the browser. */
function getSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

/** Keeps the initial server and hydration output consistent. */
function getServerSnapshot() {
  return false
}
