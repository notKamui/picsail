import { BodyLimitPlugin } from '@orpc/server/fetch'
import { env } from '@/lib/env/server'

export const uploadBodyLimitPlugin = new BodyLimitPlugin({
  maxBodySize: env.MAX_UPLOAD_BYTES + 64 * 1024,
})

export function normalizeFetchRequest(request: Request) {
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
  }

  if (request.body) {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(request.url, init)
}
