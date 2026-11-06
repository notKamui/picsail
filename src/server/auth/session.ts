import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/server/auth'

/**
 * Resolves the Better Auth session for the current server request.
 * @returns The session and user when authenticated, or null when no session exists.
 */
export async function getSession() {
  return auth.api.getSession({ headers: getRequest().headers })
}

/**
 * Checks a Better Auth role list when authorizing privileged operations.
 * @param role - Comma-separated role string, or null/undefined for no role.
 * @returns True if one trimmed role is exactly "admin".
 */
export function isAdmin(role: string | null | undefined) {
  if (!role) return false
  return role.split(',').some((part) => part.trim() === 'admin')
}
