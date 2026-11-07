import type { Plugin } from 'vite'

/**
 * Creates a development-only Vite plugin that initializes the S3 bucket when the
 * dev server starts, but not during tests. Initialization is asynchronous;
 * failures are logged.
 * @returns The Vite plugin; no storage requests occur until server configuration.
 */
export function ensureBucketPlugin(): Plugin {
  return {
    name: 'picsail-ensure-bucket',
    apply: (config, { command }) => command === 'serve' && config.mode !== 'test',
    configureServer(server) {
      void server
        .ssrLoadModule('/src/server/storage/index.ts')
        .then((mod) => {
          const storageModule = mod as { ensureBucket: () => Promise<void> }
          return storageModule.ensureBucket()
        })
        .catch((error: unknown) => {
          console.error('Failed to ensure S3 bucket', error)
        })
    },
  }
}
