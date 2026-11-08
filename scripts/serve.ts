import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { FastResponse, serve, type ServerMiddleware } from 'srvx'
import { patchGlobalRequest } from 'srvx/node'
import { staticMiddleware } from 'srvx/static'
import { user } from '../src/server/db/schema/auth'

const clientDirectory = fileURLToPath(new URL('../dist/client/', import.meta.url))
const serverEntry = new URL('../dist/server/server.js', import.meta.url)
const migrationsDirectory = fileURLToPath(new URL('../.drizzle/', import.meta.url))
const localEnvFile = fileURLToPath(new URL('../.env', import.meta.url))
const maxPreloadBytes = 5 * 1024 * 1024
const gzipMinimumBytes = 1024

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

type PreloadedAsset = {
  bytes: Uint8Array
  compressed?: Uint8Array
  etag: string
  contentType: string
  immutable: boolean
}

function isCompressible(contentType: string) {
  return (
    contentType.startsWith('text/') ||
    contentType === 'application/javascript; charset=utf-8' ||
    contentType === 'application/json; charset=utf-8' ||
    contentType === 'image/svg+xml'
  )
}

function acceptsGzip(header: string | null) {
  return (
    header?.split(',').some((encoding) => {
      const [name, ...parameters] = encoding.trim().toLowerCase().split(';')
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='))
      return (name === 'gzip' || name === '*') && Number(quality?.trim().slice(2) ?? 1) > 0
    }) ?? false
  )
}

function matchesEtag(header: string | null, etag: string) {
  return (
    header?.split(',').some((candidate) => {
      const value = candidate.trim()
      return (
        value === '*' || value === etag || value.replace(/^W\//, '') === etag.replace(/^W\//, '')
      )
    }) ?? false
  )
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []

  for (const entry of entries) {
    const path = `${directory}${sep}${entry.name}`
    if (entry.isDirectory()) paths.push(...(await listFiles(path)))
    else if (entry.isFile()) paths.push(path)
  }

  return paths
}

async function preloadStaticAssets() {
  const assets = new Map<string, PreloadedAsset>()

  for (const path of await listFiles(clientDirectory)) {
    const file = await readFile(path)
    if (file.byteLength === 0 || file.byteLength > maxPreloadBytes) continue

    const relativePath = relative(clientDirectory, path).split(sep).join('/')
    const contentType = mimeTypes[extname(path).toLowerCase()] ?? 'application/octet-stream'
    const bytes = new Uint8Array(file)
    const compressed =
      bytes.byteLength >= gzipMinimumBytes && isCompressible(contentType)
        ? gzipSync(bytes)
        : undefined
    const digest = createHash('sha1').update(bytes).digest('hex')

    assets.set(`/${relativePath}`, {
      bytes,
      compressed,
      etag: `W/"${digest}-${bytes.byteLength}"`,
      contentType,
      immutable: relativePath.startsWith('assets/'),
    })
  }

  return assets
}

function preloadMiddleware(assets: Map<string, PreloadedAsset>): ServerMiddleware {
  return (request, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return next()

    const asset = assets.get(new URL(request.url).pathname)
    if (!asset) return next()

    const headers = new Headers({
      'Cache-Control': asset.immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
      'Content-Type': asset.contentType,
      ETag: asset.etag,
    })
    if (asset.compressed) headers.set('Vary', 'Accept-Encoding')

    if (matchesEtag(request.headers.get('if-none-match'), asset.etag)) {
      return new FastResponse(null, { status: 304, headers })
    }

    const compressed =
      asset.compressed && acceptsGzip(request.headers.get('accept-encoding'))
        ? asset.compressed
        : undefined
    const body = new Uint8Array(compressed ?? asset.bytes)
    if (compressed) headers.set('Content-Encoding', 'gzip')
    headers.set('Content-Length', String(body.byteLength))

    return new FastResponse(request.method === 'HEAD' ? null : body, { headers })
  }
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required to start Picsail')

  const client = postgres(databaseUrl)
  try {
    const db = drizzle({ client })
    await migrate(db, { migrationsFolder: migrationsDirectory })

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)

    if (adminEmails.length > 0) {
      const updatedUsers = await db
        .update(user)
        .set({ role: 'admin' })
        .where(inArray(user.email, adminEmails))
        .returning({ id: user.id })
      console.info(`Granted admin access to ${updatedUsers.length} configured account(s).`)
    }
  } finally {
    await client.end()
  }
}

async function main() {
  if (existsSync(localEnvFile)) process.loadEnvFile(localEnvFile)

  await runMigrations()

  const port = Number(process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  patchGlobalRequest()
  const app = (await import(/* @vite-ignore */ serverEntry.href)) as {
    default: { fetch: (request: Request) => Response | Promise<Response> }
  }
  const assets = await preloadStaticAssets()
  const server = serve({
    hostname: '0.0.0.0',
    port,
    middleware: [
      preloadMiddleware(assets),
      staticMiddleware({ dir: clientDirectory, etag: true, compress: true }),
    ],
    fetch: app.default.fetch,
  })

  await server.ready()
  console.info(`Picsail listening on ${server.url}`)
}

await main()
