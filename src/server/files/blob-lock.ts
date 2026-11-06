import { sql } from 'drizzle-orm'
import type { Transaction } from '@/server/db/utils'

/**
 * Serializes upload, variant-cache and deletion work for one content hash across
 * PostgreSQL clients. The transaction-scoped lock is released when `tx` ends.
 * @param tx - Active transaction to hold the advisory lock.
 * @param sha256 - SHA-256 hash of the stored source bytes.
 * @returns A promise that resolves when the lock has been acquired.
 */
export async function lockBlob(tx: Transaction, sha256: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sha256}, 0))`)
}
