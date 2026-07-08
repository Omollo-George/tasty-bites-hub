import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  // Allow overriding the base/public path via the VITE_BASE env var at build time.
  // When deployed behind Django/Whitenoise we serve static files at /static/,
  // so setting VITE_BASE=/static/ makes the built assets reference /static/assets/...
  base: process.env.NODE_ENV === 'production'
    ? process.env.VITE_BASE || '/static/'
    : process.env.VITE_BASE || '/',
  root: '.',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    https: false,
    proxy: {
      // SSE endpoint needs a dedicated proxy entry to avoid ECONNRESET
      // Use no websocket handling and disable timeouts so EventSource long-polling stays open.
      '/payments/stream': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: false,
        // disable proxy timeouts for long-lived SSE connections
        timeout: 0,
        proxyTimeout: 0,
      },
      // Proxy API calls to the Django backend during local development
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/payments': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
