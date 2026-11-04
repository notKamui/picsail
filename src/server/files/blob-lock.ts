import { sql } from 'drizzle-orm'
import type { Transaction } from '@/server/db/utils'

export async function lockBlob(tx: Transaction, sha256: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sha256}, 0))`)
}
