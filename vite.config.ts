/**
 * @file vite.config.ts
 * @description Vite build configuration for ThirdEye client.
 *              - React plugin for JSX transform
 *              - Tailwind CSS v4 via @tailwindcss/vite plugin
 *              - Proxy /api and /socket.io to the Express backend (dev only)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
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
