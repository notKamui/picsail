import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from '@/lib/env/server'

const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

let bucketReady: Promise<void> | undefined

export function ensureBucket(): Promise<void> {
  bucketReady ??= createBucketIfMissing().catch((error: unknown) => {
    bucketReady = undefined
    throw error
  })
  return bucketReady
}

async function createBucketIfMissing() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
  } catch (error) {
    if (!isMissing(error)) throw error
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
  }
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
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
    if (!result.Body) return null
    return {
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
    }
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

async function remove(key: string) {
  await ensureBucket()
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

export const storage = {
  put,
  open,
  delete: remove,
}

function isMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? error.name : undefined
  if (name === 'NotFound' || name === 'NoSuchBucket' || name === 'NoSuchKey') return true
  const metadata = '$metadata' in error ? error.$metadata : undefined
  if (!metadata || typeof metadata !== 'object' || !('httpStatusCode' in metadata)) return false
  return metadata.httpStatusCode === 404
}
