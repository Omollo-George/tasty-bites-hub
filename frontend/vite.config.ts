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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('react-day-picker')) return 'date-picker';
            if (id.includes('three') || id.includes('@react-three')) return 'three-vendor';
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('next-themes')) return 'ui-vendor';
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('react') || id.includes('@tanstack/react-query')) return 'react-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
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
