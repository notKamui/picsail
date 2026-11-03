import type { Plugin } from 'vite'

export function ensureBucketPlugin(): Plugin {
  return {
    name: 'picsail-ensure-bucket',
    apply: 'serve',
    configureServer(server) {
      void server
        .ssrLoadModule('/src/server/storage.ts')
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
