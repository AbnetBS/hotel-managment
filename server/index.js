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
import { compress, serveAssets, cacheHeaders, securityHeaders, rateLimit, loginGuard, errorHandler, apiNotFound } from './security.js';
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
app.disable('etag');
app.set('trust proxy', true); // correct client IPs behind a reverse proxy
app.use(securityHeaders);
app.use(compress); // gzip the app and the API replies
app.use(express.json({ limit: '4mb' }));

// Sign-in is the door everyone tries: slow brute force right down.
app.use('/api/auth/login', loginGuard);
// The guest QR pages are public: keep them from being hammered.
app.use('/api/public', rateLimit({ name: 'public', windowMs: 60_000, max: 240, message: 'Too many requests from this device.' }));
// A sane ceiling for everything else.
app.use('/api', rateLimit({ name: 'api', windowMs: 60_000, max: 900 }));

// Read the build stamp fresh every time. Caching it at boot meant a rebuild +
// reload still reported the old version until the process restarted — which
// read as "the fix didn't deploy". Reading the file per call fixes that.
function buildId() {
  try {
    return fs.readFileSync(path.join(distDir, 'build-id.txt'), 'utf8').trim() || 'dev';
  } catch {
    return 'dev';
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, online: onlineCount(), db: path.basename(DB_PATH), version: buildId(), time: new Date().toISOString() });
});

// Identity scans never belong under the public /uploads mount. This guard is
// belt-and-braces: it refuses any `id-*` file even if one was left there by an
// older build, and it decodes the path first so a URL-encoded guess (%69d-…)
// cannot slip past. Everything else (menu photos, room photos) is still public.
app.use('/uploads', (req, res, next) => {
  let decoded = req.path;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ error: 'Bad path.' });
  }
  const base = path.basename(decoded).toLowerCase();
  if (base.startsWith('id-')) return res.status(404).json({ error: 'Not found.' });
  next();
});
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.use('/api', core);
app.use('/api/admin', admin);
app.use('/api', apiNotFound); // JSON, not the app shell

// The built React app (and the guest QR pages) are served from the same origin.
if (fs.existsSync(distDir)) {
  app.use(serveAssets(distDir)); // hashed assets, gzipped, cached in memory
  app.use(express.static(distDir, { index: false, setHeaders: cacheHeaders }));
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

// Anything thrown or passed to next() lands here — never a stack trace to the client.
app.use(errorHandler);

// Keep running no matter what: a failed background task must never close the hotel's desk.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandled]', reason?.message || reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaught]', error?.stack || error);
});

const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, HOST, () => {
  console.log(`\n  Clove House hotel system`);
  console.log(`  ─────────────────────────`);
  console.log(`  API + app      http://localhost:${PORT}`);
  console.log(`  Database       ${DB_PATH}`);
  console.log(`  Demo logins    admin / manager / cashier / waiter / kitchen / pastry / barista / juice / housekeeping  ·  PIN 1234`);
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
