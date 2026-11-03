import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/server/auth'

export async function getSession() {
  return auth.api.getSession({ headers: getRequest().headers })
}

export function isAdmin(role: string | null | undefined) {
  if (!role) return false
  return role.split(',').some((part) => part.trim() === 'admin')
}
