import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * The dev server injects inline scripts and uses a WebSocket for HMR, so the
 * source CSP keeps those exceptions. A production build has neither: the
 * bundle is an external module and every byte comes from loopback HTTP.
 */
const productionCsp = {
  name: 'bettervlc-production-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string): string {
    return html
      .replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")
      .replace(' ws://localhost:* ws://127.0.0.1:*', '')
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), productionCsp]
  }
})
