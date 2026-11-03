import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env/server'
import * as schema from '@/server/db/schema'

const postgresClient = postgres(env.DATABASE_URL)
export const db = drizzle({ client: postgresClient, schema })

export * from './utils'
