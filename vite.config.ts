/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vexflow: ['vexflow'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
