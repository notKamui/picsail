import { TmpFileUploadHandlerPlugin } from '@orpc/node'
import { env } from '@/lib/env/server'

export function createTmpFileUploadPlugin() {
  const overhead = 64 * 1024

  return new TmpFileUploadHandlerPlugin({
    maxBodySize: {
      memory: overhead,
      file: env.MAX_UPLOAD_BYTES,
      stream: env.MAX_UPLOAD_BYTES + overhead,
    },
  })
}

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
