import { TmpFileUploadHandlerPlugin } from '@orpc/node'
import { env } from '@/lib/env/server'

/**
 * Creates the oRPC multipart plugin used by request handlers to limit uploads
 * before procedures read file contents into memory.
 * @returns A temporary-file upload plugin with configured file and body limits.
 */
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

/**
 * Reconstructs an incoming request for the fetch-based oRPC handlers, retaining
 * method, headers, signal and body; streaming bodies use Node's half-duplex option.
 * @param request - Incoming request whose body will be passed through.
 * @returns A new Request sharing the original body stream.
 */
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
