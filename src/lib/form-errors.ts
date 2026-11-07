/**
 * Converts TanStack Form validation errors into the message shape used by FieldError.
 * Unrecognized values are omitted because they do not contain a displayable message.
 * @param errors - Validation errors returned for a form field.
 * @returns Displayable field error messages.
 */
export function toFieldErrors(errors: ReadonlyArray<unknown>): { message: string }[] {
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
