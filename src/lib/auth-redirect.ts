/**
 * Accepts only local paths, preventing authentication redirects to other origins.
 */
export function safeAuthRedirect(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return '/files'
  }
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code !== undefined && (code < 32 || code === 127)) return '/files'
  }
  return value
}
