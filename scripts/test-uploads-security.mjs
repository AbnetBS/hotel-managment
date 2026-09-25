/**
 * Identity-scan privacy.  Run against a live server:  npm run test:uploads
 *
 * Guest ID photographs must never be readable from the public /uploads folder —
 * not by a direct link, not by a guessed filename, not by a URL-encoded guess.
 * They are only streamed back through the authenticated API route.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ID_DIR = path.join(here, '..', 'server', 'id-docs');
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const login = async (u) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, pin: '1234' }) })).json()).token;
const api = async (t, path, init = {}) => {
  const r = await fetch(base + '/api' + path, { ...init, headers: { 'content-type': 'application/json', 'x-clove-token': t, ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
let pass = 0, fail = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); ok ? pass++ : fail++; };

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const cashier = await login('cashier');
const manager = await login('manager');

// Find a guest to attach a scan to.
const stays = await api(cashier, '/stays');
const guestId = stays.body.stays?.find((s) => s.guest?.id)?.guest.id;
check('a guest is available to test with', Boolean(guestId), guestId || 'none');

// Upload the scan.
const filesFor = () => (fs.existsSync(ID_DIR) ? fs.readdirSync(ID_DIR).filter((f) => f.startsWith(`id-${guestId}-`)) : []);
const preFiles = new Set(filesFor());
const upload = await api(cashier, `/guests/${guestId}/document`, { method: 'POST', body: JSON.stringify({ data_url: PNG }) });
const url = upload.body.url || '';
check('the scan is stored behind the API, not under /uploads', url.startsWith('/api/') && !url.startsWith('/uploads'), url);

// The signed-in desk can stream it (token in the query, like the WebSocket).
const withToken = await fetch(`${base}${url}?token=${encodeURIComponent(cashier)}`);
check('signed-in staff can view the scan', withToken.status === 200 && /image\//.test(withToken.headers.get('content-type') || ''), `status ${withToken.status}`);
check('the scan is never cached by a shared proxy', /no-store/.test(withToken.headers.get('cache-control') || ''), withToken.headers.get('cache-control') || 'none');

// Without a token it is refused.
const noToken = await fetch(`${base}${url}`);
check('the scan is refused without a token', noToken.status === 401, `status ${noToken.status}`);

// A guessed filename in the public folder is a dead end.
const guessName = `id-${guestId}-1700000000000.png`;
const guessed = await fetch(`${base}/uploads/${guessName}`);
check('a guessed /uploads/id-… path is blocked', guessed.status !== 200, `status ${guessed.status}`);

// A URL-encoded guess (%69 = i) must not slip past the guard.
const encoded = await fetch(`${base}/uploads/%69d-${guestId}-1700000000000.png`);
check('a URL-encoded id- guess is blocked too', encoded.status !== 200, `status ${encoded.status}`);

// Ordinary public images (menu / room photos) still work.
const photo = await api(manager, '/admin/uploads', { method: 'POST', body: JSON.stringify({ data_url: PNG, filename: 'menu.png' }) });
const publicUrl = photo.body.url || '';
const publicGet = publicUrl ? await fetch(`${base}${publicUrl}`) : { status: 0 };
check('normal public photos are still served from /uploads', publicUrl.startsWith('/uploads/') && publicGet.status === 200, `${publicUrl} → ${publicGet.status}`);

// Replacing a scan must not leave the previous file lingering on disk.
const mainFile = filesFor().find((f) => !preFiles.has(f)); // the file this test just created
const countBefore = filesFor().length;
await new Promise((r) => setTimeout(r, 5)); // ensure a different timestamp in the filename
await api(cashier, `/guests/${guestId}/document`, { method: 'POST', body: JSON.stringify({ data_url: PNG }) });
const filesAfter = filesFor();
const gone = mainFile && !filesAfter.includes(mainFile);
const netGrowth = filesAfter.length - countBefore; // one removed + one added → 0
check('replacing a scan deletes the previous file (folder does not grow)', gone && netGrowth === 0, `was ${mainFile}, growth ${netGrowth}`);

// Retention endpoint is available to the owner and answers cleanly.
const admin = await login('admin');
const purged = await api(admin, '/guests/purge-documents', { method: 'POST', body: JSON.stringify({ older_than_days: 30 }) });
check('retention purge is available to the owner', purged.status === 200 && typeof purged.body.purged === 'number', `${purged.body.purged} removed`);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
