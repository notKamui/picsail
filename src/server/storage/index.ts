import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
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

async function createBucketIfMissing() {
  const [error] = await tryAsync(s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })))
  if (!error) return
  if (!isMissing(error)) throw error
  await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
}

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
  }
}

async function remove(key: string) {
  await ensureBucket()
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

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

function isMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? error.name : undefined
  if (name === 'NotFound' || name === 'NoSuchBucket' || name === 'NoSuchKey') return true
  const metadata = '$metadata' in error ? error.$metadata : undefined
  if (!metadata || typeof metadata !== 'object' || !('httpStatusCode' in metadata)) return false
  return metadata.httpStatusCode === 404
}
