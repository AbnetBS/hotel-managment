import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const API_PORT = process.env.API_PORT || 4000;

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  // Modern automatic JSX runtime — no `import React` needed in every file.
  esbuild: { jsx: 'automatic' },
  plugins: [react({ jsxRuntime: 'automatic' })],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    // Allow importing from the repo-level /shared folder during dev.
    fs: { allow: [path.resolve(process.cwd()), path.resolve(process.cwd(), '..')] },
    // Everything the API needs is proxied so the browser only ever talks to one origin.
    proxy: {
      '/api': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true },
      '/uploads': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true },
      '/ws': { target: `ws://127.0.0.1:${API_PORT}`, ws: true },
    },
  },
});
