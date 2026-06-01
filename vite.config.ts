import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  // Specify the root of your Vite project, where index.html is located.
  root: 'client',
  plugins: [react()],
  build: {
    // Output the build artifacts to the 'dist' directory at the project root.
    outDir: '../dist',
    // Required when outDir is outside of the root directory
    emptyOutDir: true,
  },
});