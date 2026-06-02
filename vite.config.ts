import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  // Point Vite to the folder containing your frontend entry point (index.html)
  root: 'client', 
  plugins: [react()],
  build: {
    // Output the build artifacts to 'dist' in the root project folder
    outDir: '../dist',
    // Ensure the output directory is cleared before building
    emptyOutDir: true,
  },
});