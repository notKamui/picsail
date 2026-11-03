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
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
  },
  extends: [],
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.BUILD_ENV === 'production',
})
