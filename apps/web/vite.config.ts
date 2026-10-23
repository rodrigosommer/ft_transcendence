import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Source maps would ship our sources to the browser for no benefit here.
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    host: true,
    port: 5173,
    // Only used by 'npm run dev'; the built app is served by nginx.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
