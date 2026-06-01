import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5174,
    proxy: {
      '/api': {
        // Ensure this port matches the one your backend server listens on
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Optional: Use this if your backend API doesn't have the /api prefix
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tasty-bites-hub/shared": path.resolve(__dirname, "./shared/index.ts"),
    },
  },
}));
