/**
 * QR image route reliability.  Run against a live server:  npm run test:qr
 *
 * The route is async, so it must go through the guarded(...) wrapper — otherwise
 * a rejected promise from QRCode.toBuffer() would be unhandled and take the
 * whole Node process (every desk) down instead of returning a clean error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const login = async (u) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, pin: '1234' }) })).json()).token;
const api = async (t, path, init = {}) => {
  const r = await fetch(base + '/api' + path, { ...init, headers: { 'content-type': 'application/json', 'x-clove-token': t, ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
let pass = 0, fail = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); ok ? pass++ : fail++; };

// The source itself must show the async handler wrapped in guarded(...).
const source = fs.readFileSync(path.join(here, '..', 'server', 'routes-core.js'), 'utf8');
check('the QR route is wrapped in guarded(async …)', /qr\/:roomId\.png['"],\s*requireAuth,\s*guarded\(async/.test(source), 'grep server/routes-core.js');

const cashier = await login('cashier');
const rooms = await api(cashier, '/rooms');
const room = rooms.body.rooms?.[0];
check('a room exists to print a QR for', Boolean(room), room?.number || 'none');

// A real QR renders as a PNG (token accepted in the query for an <img>).
const good = await fetch(`${base}/api/qr/${room.id}.png?token=${encodeURIComponent(cashier)}`);
check('a QR renders as image/png', good.status === 200 && (good.headers.get('content-type') || '').includes('image/png'), `status ${good.status}`);

// An unknown room is a clean JSON 404 — not a crash.
const missing = await fetch(`${base}/api/qr/does-not-exist.png?token=${encodeURIComponent(cashier)}`);
check('an unknown room answers 404, not a crash', missing.status === 404, `status ${missing.status}`);

// The process is still alive after the error path.
const health = await fetch(`${base}/api/health`);
check('the server survived the error path', health.status === 200, `status ${health.status}`);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
