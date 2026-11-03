import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '@/lib/env/server'
import { db } from '@/server/db'
import * as authSchema from '@/server/db/schema/auth'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: env.BASE_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
  advanced: {
    database: {
      joins: true,
    },
  },
})
