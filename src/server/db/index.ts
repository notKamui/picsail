import { createServerOnlyFn } from '@tanstack/react-start'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env/server'
import * as schema from '@/server/db/schema'

export const db = createServerOnlyFn(() =>
  drizzle({ client: postgres(env.DATABASE_URL), schema }),
)()

export * from './utils'
