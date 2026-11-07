import { rootRouteId, useRouteContext } from '@tanstack/react-router'

export function useGlobalContext() {
  return useRouteContext({ from: rootRouteId })
}
