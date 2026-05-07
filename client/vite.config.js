import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4500',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Output to client/dist (Vercel looks here via vercel.json outputDirectory)
    outDir: 'dist',
    emptyOutDir: true,
  },
  publicDir: 'public',
});
