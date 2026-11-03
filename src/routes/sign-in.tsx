import { useForm } from '@tanstack/react-form'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { eyebrow, title } from '@/components/ui/typography'
import { authClient } from '@/lib/auth-client'
import { tryAsync } from '@/lib/try'

const signInSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const [authError, setAuthError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setAuthError(null)
      const [requestError, result] = await tryAsync(authClient.signIn.email(value))
      if (requestError) {
        setAuthError('Could not sign in. Please try again.')
        return
      }
      if (result.error) {
        setAuthError(result.error.message ?? 'Could not sign in')
        return
      }
      await navigate({ to: '/' })
    },
  })

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className={eyebrow()}>Picsail</p>
          <CardTitle className={title({ h: 2 })}>Sign in</CardTitle>
          <CardDescription>Use the email and password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="sign-in-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field name="email">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        autoComplete="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid ? (
                        <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                      ) : null}
                    </Field>
                  )
                }}
              </form.Field>
              <form.Field name="password">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        autoComplete="current-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid ? (
                        <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                      ) : null}
                    </Field>
                  )
                }}
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
              <Button type="submit" form="sign-in-form" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            )}
          </form.Subscribe>
          <Button variant="link" asChild className="w-full justify-center px-0">
            <Link to="/sign-up">Need an account? Create one</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

function toFieldErrors(errors: ReadonlyArray<unknown>) {
  return errors.flatMap((error) => {
    if (typeof error === 'string') return [{ message: error }]
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return [{ message: error.message }]
    }
    return []
  })
}
