import { createFileRoute } from '@tanstack/react-router'
import { article } from '@/components/ui/typography'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className={`${article} mx-auto px-6 py-16`}>
      <h1>Welcome to TanStack Start</h1>
      <p>
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
    </main>
  )
}
