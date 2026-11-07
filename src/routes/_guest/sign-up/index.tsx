import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import * as z from 'zod'
import { AuthField } from '@/components/auth-field'
import { AuthPageLayout } from '@/components/auth-page-layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { eyebrow, title } from '@/components/ui/typography'
import { authClient } from '@/lib/auth-client'
import { safeAuthRedirect } from '@/lib/auth-redirect'
import { currentUserQueryOptions } from '@/lib/session-query'
import { tryAsync } from '@/lib/try'

const signUpSchema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

export const Route = createFileRoute('/_guest/sign-up/')({
  validateSearch: z.object({
    redirect: z.unknown().optional(),
  }),
  head: () => ({ meta: [{ title: 'Create account · Picsail' }] }),
  component: SignUpPage,
})

function SignUpPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect } = Route.useSearch()
  const returnTo = safeAuthRedirect(redirect)
  const [authError, setAuthError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setAuthError(null)
      const [requestError, result] = await tryAsync(authClient.signUp.email(value))
      if (requestError) {
        setAuthError('Could not create your account. Please try again.')
        return
      }
      if (result.error) {
        setAuthError(result.error.message ?? 'Could not create your account')
        return
      }
      await queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey })
      await navigate({ href: returnTo })
      await router.invalidate()
    },
  })

  return (
    <AuthPageLayout>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <p className={eyebrow()}>Picsail</p>
          <CardTitle>
            <h2 className={title({ h: 2 })}>Create account</h2>
          </CardTitle>
          <CardDescription>Register with your email and choose a password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="sign-up-form"
            method="post"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => (
                  <AuthField field={field} label="Name" type="text" autoComplete="name" />
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <AuthField field={field} label="Email" type="email" autoComplete="email" />
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <AuthField
                    field={field}
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                  />
                )}
              </form.Field>
              {authError ? (
                <Field data-invalid>
                  <FieldError>{authError}</FieldError>
                </Field>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" form="sign-up-form" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            )}
          </form.Subscribe>
          <Button variant="link" asChild className="w-full justify-center px-0">
            <Link to="/sign-in" search={{ redirect: returnTo }}>
              Already have an account? Sign in
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthPageLayout>
  )
}
