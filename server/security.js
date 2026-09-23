import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Small, dependency-free security layer.
 *
 *   securityHeaders  → a few safe defaults on every response
 *   rateLimit        → per-IP (and optionally per-key) throttling for the
 *                      endpoints people attack: sign-in and the public QR pages
 *   errorHandler     → logs the real error, returns a friendly one
 *
 * Nothing here needs a proxy or a config file, so it works the same on a laptop
 * behind the desk and on a server in the cloud.
 */

/* ------------------------------------------------------------------ *
 * Performance: gzip + cache headers. Small hotels run this on a tiny
 * box or a phone hotspot, so every kilobyte over the wire matters.
 * ------------------------------------------------------------------ */


/**
 * gzip on the way out. The decision is made when the body is known (that is
 * the only moment the content type is final), so both API JSON and the built
 * app are compressed.
 */
export function compress(req, res, next) {
  if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();

  const finish = res.end.bind(res);
  const normalSend = res.send.bind(res);

  res.send = (body) => {
    if (res.getHeader('Content-Encoding') || body === undefined || body === null) return normalSend(body);
    const buffer = Buffer.isBuffer(body) ? body : typeof body === 'string' ? Buffer.from(body) : null;
    if (!buffer) return normalSend(body); // objects / streams go on untouched
    const type = String(res.getHeader('Content-Type') || '');
    const compressible = /json|javascript|ecmascript|css|html|svg|text|xml|manifest/i.test(type);
    if (!compressible || buffer.length < 700) return normalSend(body);
    const gzipped = zlib.gzipSync(buffer, { level: 6 });
    if (gzipped.length >= buffer.length) return normalSend(body);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Length', String(gzipped.length));
    return finish(gzipped);
  };
  next();
}

/**
 * The built app is served from memory, already gzipped.
 * Assets have a content hash in the name, so they are cached for a year and a
 * restart of the server is the only thing that changes them.
 */
const assetCache = new Map();

export function serveAssets(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  return (req, res, next) => {
    if (!req.path.startsWith('/assets/')) return next();
    const name = req.path.replace('/assets/', '');
    if (name.includes('..') || name.includes('/')) return next();
    let entry = assetCache.get(name);
    if (!entry) {
      const file = path.join(assetsDir, name);
      if (!fs.existsSync(file)) return next();
      const rawBuffer = fs.readFileSync(file);
      entry = {
        raw: rawBuffer,
        gzip: /\.(?:js|css|svg|json|map)$/i.test(name) ? zlib.gzipSync(rawBuffer, { level: 6 }) : null,
        type: name.endsWith('.css') ? 'text/css; charset=utf-8'
          : name.endsWith('.js') ? 'text/javascript; charset=utf-8'
          : name.endsWith('.svg') ? 'image/svg+xml'
          : name.endsWith('.json') ? 'application/json; charset=utf-8'
          : 'application/octet-stream',
      };
      assetCache.set(name, entry);
    }
    const wantsGzip = Boolean(entry.gzip) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const body = wantsGzip ? entry.gzip : entry.raw;
    res.setHeader('Content-Type', entry.type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept-Encoding');
    if (wantsGzip) res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(body.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  };
}

/**
 * Static assets: files with a content hash in the name can be cached for a
 * year, everything else (the HTML shell) must never be stale.
 * Signature matches express.static's setHeaders(res, path).
 */
export function cacheHeaders(res, filePath = '') {
  if (/\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|map)$/i.test(filePath)) {
    res.setHeader(
      'Cache-Control',
      /index-|-[A-Za-z0-9_-]{8}\./.test(filePath) ? 'public, max-age=31536000, immutable' : 'public, max-age=604800',
    );
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
}

/** Headers that make the browser behave, without breaking the app or uploads. */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // The app is served from this origin only: no inline scripts from elsewhere,
  // no remote frames. (Vite bundles everything, styles are inline by design.)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
}

/**
 * Simple sliding-window limiter held in memory.
 *
 * For one hotel on one server that is exactly right: no Redis, no surprises.
 * If the system is ever run on several machines, swap the store for a shared one.
 */
const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}, 60_000).unref?.();

export function rateLimit({ name = 'api', windowMs = 60_000, max = 60, key = (req) => req.ip, message = 'Too many requests — please slow down.' } = {}) {
  return (req, res, next) => {
    const bucketKey = `${name}:${key(req)}`;
    const now = Date.now();
    let entry = buckets.get(bucketKey);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `${message} Try again in ${retry}s.` });
    }
    next();
  };
}

/* ---------------------------- sign-in guard ------------------------------ */
/**
 * Sign-in is throttled on *failed* attempts only, keyed by the desk's IP and the
 * username being tried. That stops PIN guessing without ever locking a cashier
 * out of her own account because somebody else hammered the door.
 */
const LOGIN_MAX = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);
const LOGIN_WINDOW = 5 * 60_000;

const loginKeyOf = (req) => `login:${req.ip}:${String(req.body?.username || '').toLowerCase().slice(0, 40)}`;

export function loginGuard(req, res, next) {
  const entry = buckets.get(loginKeyOf(req));
  const now = Date.now();
  if (entry && entry.resetAt > now && entry.count >= LOGIN_MAX) {
    const retry = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retry));
    return res.status(429).json({ error: `Too many wrong PINs for "${req.body?.username}". Try again in ${retry}s, or ask the manager to reset the PIN.` });
  }
  if (entry && entry.resetAt <= now) buckets.delete(loginKeyOf(req));
  next();
}

export function recordLoginFailure(req) {
  const key = loginKeyOf(req);
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + LOGIN_WINDOW });
  else entry.count += 1;
  return LOGIN_MAX - (buckets.get(key)?.count || 0);
}

export function clearLoginFailures(req) {
  buckets.delete(loginKeyOf(req));
}

/**
 * The last stop for anything thrown: the detail goes to the server log (and the
 * audit trail when it matters), the client only ever gets a plain message.
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = Number(err?.status) || 500;
  console.error(`[api] ${req.method} ${req.originalUrl} →`, err?.message || err);
  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message,
  });
}

/** JSON (not an HTML page) when an API path does not exist. */
export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Unknown API endpoint.' });
}
