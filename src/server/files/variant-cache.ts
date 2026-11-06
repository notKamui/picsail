import { ORPCError } from '@orpc/server'
import { asc, eq, sql } from 'drizzle-orm'
import { env } from '@/lib/env/server'
import { db, takeUniqueOrNull, type Transaction } from '@/server/db'
import { blob, imageVariantCache } from '@/server/db/schema/file'
import { storage } from '@/server/storage'
import { lockBlob } from './blob-lock'

const CACHE_LOCK_KEY = 'picsail:image-variant-cache'

/**
 * Looks up a resized object for the public-image response.
 * Expired objects are deleted; an existing object without a catalog entry may be
 * registered and trigger eviction. An S3 miss does not remove a stale catalog row.
 *
 * @param key - S3 cache key, including the blob hash and transform.
 * @param sha256 - Source blob hash used to synchronize cache mutations.
 * @returns The storage object and its readable stream, or null on a miss or expiry.
 */
export async function openCachedVariant(key: string, sha256: string) {
  const cached = await storage.open(key)
  if (!cached) return null

  const entry = await db
    .select({ createdAt: imageVariantCache.createdAt })
    .from(imageVariantCache)
    .where(eq(imageVariantCache.key, key))
    .then(takeUniqueOrNull)

  const createdAt = entry?.createdAt ?? cached.lastModified
  if (createdAt && isExpired(createdAt)) {
    await removeExpiredVariant(key, sha256, createdAt)
    return null
  }

  if (!entry && cached.contentLength !== null) {
    await registerExistingVariant(key, sha256, cached.contentLength)
  }

  return cached
}

/**
 * Stores a newly generated variant, then enforces the cache's age, byte and item limits.
 * Holds the blob lock followed by the global cache lock in a transaction. The S3
 * write and evictions are external side effects and cannot be rolled back with SQL.
 * A variant larger than the byte limit is not stored, but trimming still runs.
 *
 * @param key - Destination S3 cache key.
 * @param sha256 - Source blob hash; the blob must still exist.
 * @param bytes - Encoded variant to store.
 * @param contentType - MIME type recorded on the S3 object.
 * @returns A promise that resolves after storage, catalog updates and eviction.
 * @throws NOT_FOUND if the source blob no longer exists; storage/database errors propagate.
 */
export async function storeCachedVariant(
  key: string,
  sha256: string,
  bytes: Uint8Array,
  contentType: string,
) {
  await db.transaction(async (tx) => {
    await lockBlob(tx, sha256)
    await lockVariantCache(tx)
    await assertBlobExists(tx, sha256)

    if (bytes.byteLength <= env.IMAGE_CACHE_MAX_BYTES) {
      await storage.put(key, bytes, contentType)
      await tx
        .insert(imageVariantCache)
        .values({
          key,
          blobSha256: sha256,
          byteSize: bytes.byteLength,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: imageVariantCache.key,
          set: {
            blobSha256: sha256,
            byteSize: bytes.byteLength,
            createdAt: new Date(),
          },
        })
    }

    await trimVariantCache(tx)
  })
}

/**
 * Removes a deleted blob's variants from S3 after taking the global cache lock.
 * Used by blob cleanup; its caller must already hold the blob lock. Catalog rows
 * are removed separately by the blob's database cascade.
 *
 * @param tx - Active transaction holding the source blob's advisory lock.
 * @param sha256 - Hash identifying the S3 cache prefix to delete.
 * @returns A promise that resolves when all listed objects have been removed.
 */
export async function removeCachedVariants(tx: Transaction, sha256: string) {
  await lockVariantCache(tx)
  await storage.removePrefix(`cache/${sha256}/`)
}

/**
 * Adopts an existing S3 variant that has no catalog entry, for example one created
 * before the catalog existed. Serializes with deletion and cache eviction, then
 * applies limits. The inserted timestamp is the registration time.
 *
 * @param key - Existing S3 cache key.
 * @param sha256 - Source blob hash, which must still exist.
 * @param byteSize - Size reported by S3 in bytes.
 * @returns A promise that resolves after registration and any eviction.
 */
async function registerExistingVariant(key: string, sha256: string, byteSize: number) {
  await db.transaction(async (tx) => {
    await lockBlob(tx, sha256)
    await lockVariantCache(tx)
    await assertBlobExists(tx, sha256)
    await tx
      .insert(imageVariantCache)
      .values({ key, blobSha256: sha256, byteSize })
      .onConflictDoNothing()
    await trimVariantCache(tx)
  })
}

/**
 * Removes an expired object and its catalog entry while serializing with writers.
 * A catalog timestamp change means another writer refreshed the entry, so it is
 * left alone. S3 deletion is not transactional with the database.
 *
 * @param key - Expired S3 cache key.
 * @param sha256 - Source blob hash whose advisory lock must be acquired first.
 * @param createdAt - Timestamp observed by the reader before taking the locks.
 * @returns A promise that resolves after deletion or a concurrent-refresh skip.
 */
async function removeExpiredVariant(key: string, sha256: string, createdAt: Date) {
  await db.transaction(async (tx) => {
    await lockBlob(tx, sha256)
    await lockVariantCache(tx)
    const entry = await tx
      .select({ createdAt: imageVariantCache.createdAt })
      .from(imageVariantCache)
      .where(eq(imageVariantCache.key, key))
      .then(takeUniqueOrNull)

    if (entry && entry.createdAt.getTime() !== createdAt.getTime()) return
    await storage.remove(key)
    await tx.delete(imageVariantCache).where(eq(imageVariantCache.key, key))
  })
}

/**
 * Evicts cataloged variants in creation-time order after a cache insertion or
 * registration. Expired entries and then the oldest entries exceeding the byte
 * or item limits are removed from S3 and the catalog; reads do not refresh age.
 * S3 removals cannot be rolled back if the enclosing transaction fails.
 *
 * @param tx - Active transaction already holding the global cache advisory lock.
 * @returns A promise that resolves after all required evictions.
 */
async function trimVariantCache(tx: Transaction) {
  const entries = await tx
    .select({
      key: imageVariantCache.key,
      byteSize: imageVariantCache.byteSize,
      createdAt: imageVariantCache.createdAt,
    })
    .from(imageVariantCache)
    .orderBy(asc(imageVariantCache.createdAt))

  let totalBytes = entries.reduce((total, entry) => total + entry.byteSize, 0)
  let itemCount = entries.length
  const maxAge = env.IMAGE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()

  for (const entry of entries) {
    const expired = now - entry.createdAt.getTime() >= maxAge
    if (
      !expired &&
      totalBytes <= env.IMAGE_CACHE_MAX_BYTES &&
      itemCount <= env.IMAGE_CACHE_MAX_ITEMS
    ) {
      break
    }

    await storage.remove(entry.key)
    await tx.delete(imageVariantCache).where(eq(imageVariantCache.key, entry.key))
    totalBytes -= entry.byteSize
    itemCount -= 1
  }
}

/**
 * Rechecks a source blob under its advisory lock before caching a variant.
 *
 * @param tx - Active transaction holding the blob lock.
 * @param sha256 - Hash of the source blob to check.
 * @returns A promise resolving without a value if the blob exists.
 * @throws NOT_FOUND when the blob was deleted.
 */
async function assertBlobExists(tx: Transaction, sha256: string) {
  const existingBlob = await tx
    .select({ sha256: blob.sha256 })
    .from(blob)
    .where(eq(blob.sha256, sha256))
    .then(takeUniqueOrNull)
  if (!existingBlob) throw new ORPCError('NOT_FOUND')
}

/**
 * Serializes catalog updates and eviction across application instances using a
 * transaction-scoped PostgreSQL advisory lock. Acquire a blob lock first whenever
 * both locks are needed, as in variant creation and deletion.
 *
 * @param tx - Transaction that will hold the lock until completion.
 * @returns A promise resolving when the lock has been acquired.
 */
async function lockVariantCache(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${CACHE_LOCK_KEY}, 0))`)
}

/**
 * Tests a cache creation timestamp against the configured age limit.
 *
 * @param createdAt - Catalog creation time or S3 last-modified time.
 * @returns Whether the timestamp is at least IMAGE_CACHE_TTL_DAYS old.
 */
function isExpired(createdAt: Date) {
  const maxAge = env.IMAGE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - createdAt.getTime() >= maxAge
}
