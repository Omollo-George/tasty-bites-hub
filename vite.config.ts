import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  // Set root to project directory where index.html is located
  root: './',
  plugins: [react()],
  build: {
    // Output the build artifacts to 'dist'
    outDir: 'dist',
    // Ensure the output directory is cleared before building
    emptyOutDir: true,
  },
});