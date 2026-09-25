import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_PORT = process.env.API_PORT || 4000;
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Stamp every build so /api/health can report exactly which bundle is live. */
function buildStamp() {
  let root = rootDir;
  let outDir = 'dist';
  return {
    name: 'clove-build-stamp',
    apply: 'build',
    configResolved(config) {
      root = config.root || rootDir; // absolute path to the vite root ("client")
      outDir = config.build?.outDir || 'dist'; // may be relative to root, e.g. "../dist"
    },
    closeBundle() {
      const target = path.resolve(root, outDir);
      const stamp = process.env.BUILD_ID || new Date().toISOString();
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'build-id.txt'), stamp);
    },
  };
}

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  // Modern automatic JSX runtime — no `import React` needed in every file.
  esbuild: { jsx: 'automatic' },
  plugins: [react({ jsxRuntime: 'automatic' }), buildStamp()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    // Arena previews use <port>-<sandbox>.e2b.app hostnames. Vite 7 blocks
    // these by default unless the preview domain is allow-listed.
    allowedHosts: ['.e2b.app'],
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
