import { createFileRoute } from '@tanstack/react-router'
import { UploadWorkspace } from '@/components/upload-workspace'
import { personalFilesQueryOptions } from '@/lib/file-list-query'
import { tryAsync } from '@/lib/try'

export const Route = createFileRoute('/_workspace/files/')({
  head: () => ({ meta: [{ title: 'My files · Picsail' }] }),
  loader: async ({ context }) => {
    const [error] = await tryAsync(
      context.queryClient.query(personalFilesQueryOptions(context.user.id, 1)),
    )
    if (error) console.error('Could not preload personal files:', error)
  },
  component: Home,
})

function Home() {
  const { user } = Route.useRouteContext()
  return <UploadWorkspace key={user.id} userId={user.id} />
}
