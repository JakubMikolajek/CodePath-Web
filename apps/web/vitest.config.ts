import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '@workspace/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    exclude: ['.next/**', 'e2e/**', 'node_modules/**'],
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts']
  }
})
