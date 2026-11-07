import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import { DevTools } from '@/components/devtools'
import { SIDEBAR_PREFERENCE_COOKIE } from '@/components/ui/sidebar'
import appCss from '../styles.css?url'

/**
 * Reads the sidebar preference from the incoming request for consistent SSR and hydration.
 * @returns The preferred desktop sidebar state.
 */
const getInitialSidebarPreference = createServerFn({ method: 'GET' }).handler(() => {
  setResponseHeader('Cache-Control', 'private, no-store')
  const preference = getCookie(SIDEBAR_PREFERENCE_COOKIE)
  return preference === undefined || preference === 'true'
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  beforeLoad: async () => ({ sidebarOpen: await getInitialSidebarPreference() }),
  head: () => ({
    meta: [
      {
        charSet: 'utf8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <DevTools />
        <Scripts />
      </body>
    </html>
  )
}
