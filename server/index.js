/**
 * Clove House — one process serves the API, the live updates and the web app.
 *
 *   npm run dev     API on :4000 + Vite dev server on :5173 (recommended while building)
 *   npm run build   bundles the React app into dist/
 *   npm start       serves the built app + API on :4000 (what you deploy)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { DB_PATH, UPLOAD_DIR, db } from './db.js';
import { ensureSeed } from './seed.js';
import { attachRealtime, onlineCount } from './realtime.js';
import { core } from './routes-core.js';
import { admin } from './routes-admin.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist');

const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';

const created = ensureSeed();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, online: onlineCount(), db: path.basename(DB_PATH), time: new Date().toISOString() });
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/api', core);
app.use('/api/admin', admin);

// The built React app (and the guest QR pages) are served from the same origin.
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('html').send(
      `<body style="font-family:system-ui;padding:40px;max-width:640px;margin:auto">
        <h1>Clove House API is running</h1>
        <p>The web app has not been built yet. Run <code>npm run build</code>, then reload — or use <code>npm run dev</code> and open the Vite URL (port 5173).</p>
        <p><a href="/api/health">/api/health</a></p>
      </body>`,
    );
  });
}

const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, HOST, () => {
  console.log(`\n  Clove House hotel system`);
  console.log(`  ─────────────────────────`);
  console.log(`  API + app      http://localhost:${PORT}`);
  console.log(`  Database       ${DB_PATH}`);
  console.log(`  Demo logins    admin / cashier / waiter / kitchen / barista / juice  ·  PIN 1234`);
  if (created) console.log(`  ✓ First run: demo hotel created`);
  console.log('');
});

const shutdown = () => {
  try {
    db.close();
  } catch {
    /* ignore */
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
