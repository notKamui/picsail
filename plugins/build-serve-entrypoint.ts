import * as Vite from 'vite-plus'

export function buildServeEntrypoint(): Vite.PluginOption {
  let built = false

  return {
    name: 'picsail-build-serve-entrypoint',
    apply: 'build',
    async writeBundle(_options, bundle) {
      if (built || !Object.hasOwn(bundle, 'server.js')) return
      built = true

      await Vite.build({
        appType: 'custom',
        build: {
          ssr: 'scripts/serve.ts',
          copyPublicDir: false,
          emptyOutDir: false,
          minify: 'oxc',
          outDir: 'dist',
          rolldownOptions: {
            external: (id) => !id.startsWith('.') && !id.startsWith('/'),
            output: {
              entryFileNames: 'serve.js',
              format: 'es',
              codeSplitting: false,
            },
          },
          target: 'node26',
        },
        configFile: false,
        oxc: { target: 'node26' },
      })
    },
  }
}
