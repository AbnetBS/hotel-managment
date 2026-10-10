/**
 * PostgreSQL integration smoke test.
 *
 * Boots an embedded PostgreSQL, seeds the demo hotel into it, starts the API
 * against DATABASE_URL=postgres://… and walks the money path: sign in, room
 * board, reports periods, check-in, charge, payment, checkout.
 *
 *   node scripts/test-postgres.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = 4321;
const PG_PORT = 55432;
const base = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clove-pg-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const ok = (label) => { passed += 1; console.log(`✅ ${label}`); };
const bad = (label, detail = '') => { failed += 1; console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); };
const check = (label, cond, detail = '') => (cond ? ok(label) : bad(label, detail));

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: tmp,
    user: 'clove',
    password: 'clove',
    port: PG_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('clove');
  const url = `postgres://clove:clove@127.0.0.1:${PG_PORT}/clove`;

  // 1. seed the demo hotel into PostgreSQL
  const seed = await run('node', ['server/seed.js', '--reset'], { ...process.env, DATABASE_URL: url });
  check('seed runs on PostgreSQL', seed.code === 0, seed.err.slice(-300));

  // 2. start the API against it
  const server = spawn('node', ['server/index.js'], {
    cwd: base, env: { ...process.env, DATABASE_URL: url, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });

  let health = null;
  for (let i = 0; i < 60 && !health; i += 1) {
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) health = await res.json();
    } catch { /* not up yet */ }
  }
  check('API boots against PostgreSQL', !!health, log.slice(-400));
  check('health reports the pg engine', health?.db === 'postgresql', JSON.stringify(health));

  // 3. sign in (the login path the customer could not reach before)
  const login = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'cashier', pin: '1234' }),
  });
  const loginBody = await login.json();
  check('cashier signs in', login.status === 200 && !!loginBody.token, JSON.stringify(loginBody));
  const auth = { 'content-type': 'application/json', 'x-clove-token': loginBody.token };

  // 4. room board + stays + reports
  const roomsRes = await fetch(`http://127.0.0.1:${PORT}/api/rooms`, { headers: auth });
  const roomsBody = await roomsRes.json();
  check('room board loads', roomsRes.ok && Array.isArray(roomsBody.rooms) && roomsBody.rooms.length > 0, String(roomsRes.status));
  const occupied = roomsBody.rooms.filter((r) => r.status === 'occupied');
  check('demo occupied rooms exist', occupied.length > 0);

  const periods = await fetch(`http://127.0.0.1:${PORT}/api/reports/periods`, {
    headers: { 'x-clove-token': (await adminToken()).token },
  });
  const periodsBody = await periods.json();
  check('reports/periods loads (day/week/month)', periods.ok && periodsBody.days?.length === 3 && periodsBody.week && periodsBody.month, JSON.stringify(periodsBody).slice(0, 120));

  // 5. full money path on a free room: check in → charge → payment → checkout
  const free = roomsBody.rooms.find((r) => r.status === 'available' && !r.stay);
  check('a free room is available', !!free);
  if (free) {
    const checkin = await fetch(`http://127.0.0.1:${PORT}/api/rooms/${free.id}/checkin`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ guest: { full_name: 'PG Test Guest', phone: '0911223344' }, billing_mode: 'nightly', rate: 2500 }),
    });
    const checkinBody = await checkin.json();
    check('check-in works on PostgreSQL', checkin.ok, JSON.stringify(checkinBody).slice(0, 160));
    const stayId = checkinBody.stay?.id || checkinBody.folio?.id;

    if (stayId) {
      const charge = await fetch(`http://127.0.0.1:${PORT}/api/stays/${stayId}/charge`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ kind: 'food', description: 'Lunch', amount: 320 }),
      });
      check('folio charge lands', charge.ok, String(charge.status));

      const pay = await fetch(`http://127.0.0.1:${PORT}/api/stays/${stayId}/payment`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ amount: 1000, method: 'Cash', client_ref: `pg-${Date.now()}` }),
      });
      check('payment lands', pay.ok, String(pay.status));

      const checkout = await fetch(`http://127.0.0.1:${PORT}/api/stays/${stayId}/checkout`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ payments: [{ amount: 5000, method: 'Cash' }], release: true, client_ref: `pgout-${Date.now()}` }),
      });
      const checkoutBody = await checkout.json();
      check('checkout + receipt folio returns', checkout.ok && checkoutBody.folio?.totals, JSON.stringify(checkoutBody).slice(0, 160));
      check('folio totals add up (room + food)', (checkoutBody.folio?.totals?.food || 0) >= 320);
    }
  }

  // 6. guest public page (no login)
  const pub = await fetch(`http://127.0.0.1:${PORT}/api/public/hotel`);
  const pubBody = await pub.json();
  check('public site info serves hero text', pub.ok && 'hero_title' in pubBody.hotel, JSON.stringify(pubBody).slice(0, 120));

  server.kill('SIGTERM');
  await pg.stop();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);

  async function adminToken() {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }),
    });
    return res.json();
  }
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: base, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

main().catch((error) => {
  console.error('pg test crashed:', error);
  process.exit(1);
});
