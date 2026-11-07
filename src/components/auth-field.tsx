import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toFieldErrors } from '@/lib/form-errors'

type AuthFieldState = {
  name: string
  state: {
    value: string
    meta: { isTouched: boolean; isValid: boolean; errors: ReadonlyArray<unknown> }
  }
  handleBlur: () => void
  handleChange: (value: string) => void
}

export function AuthField({
  field,
  label,
  type,
  autoComplete,
}: {
  field: AuthFieldState
  label: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  const errors = isInvalid ? toFieldErrors(field.state.meta.errors) : []
  const errorId = errors.some((error) => error.message) ? `${field.name}-error` : undefined

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={isInvalid}
        aria-describedby={errorId}
      />
      {errorId && <FieldError id={errorId} errors={errors} />}
    </Field>
  )
}
