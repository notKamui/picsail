import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { article, eyebrow, text, title } from '@/components/ui/typography'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Picsail' }],
  }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await authClient.signOut()
      await navigate({ to: '/' })
    } catch {
      await navigate({ to: '/' })
    }
    setIsSigningOut(false)
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className={eyebrow()}>Picsail</p>
          <CardTitle className={title({ h: 1 })}>A quiet place for pictures</CardTitle>
          <CardDescription className={text({ variant: 'muted' })}>
            Upload originals, share a hash URL, and keep a private delete code for each file.
          </CardDescription>
        </CardHeader>
        <CardContent className={`${article} space-y-4`}>
          <p>Signed-in users can create an upload, copy a public URL, and remove files they own.</p>
          <ul className="m-0 list-disc pl-5">
            <li>Fast hash-based sharing</li>
            <li>Delete-by-code and owner cleanup</li>
            <li>Private admin controls</li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/sign-up">Create account</Link>
          </Button>
          <Button type="button" variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
