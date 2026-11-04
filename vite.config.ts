import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'
import fmt from './oxfmt.config.ts'
import lint from './oxlint.config.ts'
import { ensureBucketPlugin } from './plugins/ensure-bucket.ts'

const config = defineConfig({
  server: {
    port: 3000,
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt,
  lint,
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    react(),
    ensureBucketPlugin(),
  ]),
  run: {
    cache: {
      scripts: true,
    },
    tasks: {
      up: {
        command: 'vpx taze major -lI --maturity-period 1 --request-timeout 10000',
        cache: false,
      },
    },
  },
})

export default config
