/**
 * @file vite.config.ts
 * @description Vite build configuration for ThirdEye client.
 *              - React plugin for JSX transform
 *              - Tailwind CSS v4 via @tailwindcss/vite plugin
 *              - Proxy /api and /socket.io to the Express backend (dev only)
 *              - @mediapipe/tasks-vision excluded from esbuild pre-bundling
 *                because WASM-containing packages break in the optimiser;
 *                it is loaded via dynamic import at runtime instead.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:      'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws:     true,
      },
    },
  },
});

