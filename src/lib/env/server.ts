import { createEnv } from '@t3-oss/env-core'
import * as z from 'zod'

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']),
    BASE_URL: z.url(),
    PORT: z
      .string()
      .default('3000')
      .transform((s) => Number.parseInt(s, 10)),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(20 * 1024 * 1024),
    IMAGE_CACHE_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(1024 * 1024 * 1024),
    IMAGE_CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(1000),
    IMAGE_CACHE_TTL_DAYS: z.coerce.number().int().positive().default(30),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(1).default('picsail'),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
  },
  extends: [],
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.BUILD_ENV === 'production',
})
