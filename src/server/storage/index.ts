import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createServerOnlyFn } from '@tanstack/react-start'
import { env } from '@/lib/env/server'
import { tryAsync } from '@/lib/try'

const s3 = createServerOnlyFn(
  () =>
    new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    }),
)()

let bucketReady: Promise<void> | undefined

/**
 * Initializes the S3 bucket and cache-expiration lifecycle rule on first storage
 * access. Concurrent callers share the initialization promise; failures reset it
 * so a later call can retry.
 * @returns A promise resolving when the bucket and lifecycle rule are ready.
 */
export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const [error] = await tryAsync(createBucketIfMissing())
    if (error) {
      bucketReady = undefined
      throw error
    }
  })()
  return bucketReady
}

/**
 * Checks the configured bucket, creates it if missing, and configures cache expiry.
 * Performs S3 requests and propagates errors other than a missing bucket.
 * @returns A promise resolving when initialization completes.
 */
async function createBucketIfMissing() {
  const [error] = await tryAsync(s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })))
  if (error) {
    if (!isMissing(error)) throw error
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
  }
  await ensureCacheExpirationRule()
}

/**
 * Installs or replaces Picsail's cache-prefix expiration rule, preserving other
 * lifecycle rules returned by S3. Called during bucket initialization.
 * @returns A promise resolving after the lifecycle configuration is written.
 */
async function ensureCacheExpirationRule() {
  const [error, current] = await tryAsync(
    s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: env.S3_BUCKET })),
  )
  if (error && !isMissingLifecycleConfiguration(error)) throw error

  const rules = error ? [] : (current.Rules ?? [])
  const otherRules = rules.filter((rule) => rule.ID !== 'picsail-image-cache-expiration')
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: env.S3_BUCKET,
      LifecycleConfiguration: {
        Rules: [
          ...otherRules,
          {
            ID: 'picsail-image-cache-expiration',
            Status: 'Enabled',
            Filter: { Prefix: 'cache/' },
            Expiration: { Days: env.IMAGE_CACHE_TTL_DAYS },
          },
        ],
      },
    }),
  )
}

/**
 * Writes an original or cached variant into the configured S3 bucket.
 * @param key - Destination object key.
 * @param body - Encoded bytes to upload.
 * @param contentType - MIME type stored with the object.
 * @returns A promise resolving after the S3 write.
 */
export async function put(key: string, body: Uint8Array, contentType: string) {
  await ensureBucket()
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

/**
 * Opens a stored original or variant without buffering the object in memory.
 * @param key - S3 object key to retrieve.
 * @returns A web stream with available content metadata, or null if missing/no body.
 * @throws Non-missing S3 errors.
 */
export async function open(key: string) {
  await ensureBucket()
  const [error, result] = await tryAsync(
    s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })),
  )
  if (error) {
    if (isMissing(error)) return null
    throw error
  }
  if (!result.Body) return null
  return {
    body: result.Body.transformToWebStream(),
    contentType: result.ContentType ?? null,
    contentLength: result.ContentLength ?? null,
    lastModified: result.LastModified ?? null,
  }
}

/**
 * Deletes a single original or cached object from S3.
 * @param key - Object key to delete.
 * @returns A promise resolving after S3 accepts the delete.
 */
async function remove(key: string) {
  await ensureBucket()
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

/**
 * Deletes the objects under a blob's cache prefix using paginated S3 listings and
 * batch deletes. Errors or incomplete listings are surfaced to the caller.
 * @param prefix - Exact S3 key prefix whose objects should be removed.
 * @returns A promise resolving when all listed batches have been deleted.
 */
async function removePrefix(prefix: string) {
  await ensureBucket()
  let continuationToken: string | undefined

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    const objects = result.Contents?.flatMap((object) => (object.Key ? [{ Key: object.Key }] : []))

    if (objects?.length) {
      const deleted = await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: { Objects: objects, Quiet: true },
        }),
      )
      if (deleted.Errors?.length) {
        throw new Error(`Failed to delete ${deleted.Errors.length} object(s) from ${prefix}`)
      }
    }

    if (!result.IsTruncated) break
    if (!result.NextContinuationToken) {
      throw new Error(`S3 returned a truncated listing without a continuation token for ${prefix}`)
    }
    continuationToken = result.NextContinuationToken
  } while (continuationToken)
}

export const storage = {
  put,
  open,
  remove,
  removePrefix,
}

/**
 * Classifies S3 missing-object/bucket responses for initialization and reads.
 * @param error - Error returned by an S3 operation.
 * @returns True for recognized missing-resource names or an HTTP 404.
 */
function isMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? error.name : undefined
  if (name === 'NotFound' || name === 'NoSuchBucket' || name === 'NoSuchKey') return true
  const metadata = '$metadata' in error ? error.$metadata : undefined
  if (!metadata || typeof metadata !== 'object' || !('httpStatusCode' in metadata)) return false
  return metadata.httpStatusCode === 404
}

/**
 * Recognizes the S3 response for a bucket without lifecycle rules.
 * @param error - Error returned when reading lifecycle configuration.
 * @returns True only for NoSuchLifecycleConfiguration.
 */
function isMissingLifecycleConfiguration(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? error.name : undefined
  return name === 'NoSuchLifecycleConfiguration'
}
