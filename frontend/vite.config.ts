import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'node:path'

function escapeInlineScriptString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\x3C')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const amapSecurityJsCode = escapeInlineScriptString(env.VITE_AMAP_SECURITY_JS_CODE || '')

  return {
    plugins: [
      react(),
      {
        name: 'hello-journey-inject-amap-security-code',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string) {
            return html.replaceAll('%VITE_AMAP_SECURITY_JS_CODE%', amapSecurityJsCode)
          },
        },
      },
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      css: true,
    },
    build: {
      // ECharts and maps are lazy-loaded; keep them outside the initial route chunk.
      chunkSizeWarningLimit: 600,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:8000',
          ws: true,
        },
      },
    },
  }
})
