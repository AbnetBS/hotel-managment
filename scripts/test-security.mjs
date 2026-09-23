/** API-level checks. Run against a live server:   npm run test:api
 *  (the security suite deliberately pauses a username, so restart the server
 *   afterwards, or before a demo.)  */
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
let pass = 0, fail = 0;
const check = (l, ok, x = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${x ? ' — ' + x : ''}`); ok ? pass++ : fail++; };

// headers
const page = await fetch(base + '/');
const h = (k) => page.headers.get(k);
check('security headers on the app', h('x-content-type-options') === 'nosniff' && !!h('content-security-policy'), `CSP ${h('content-security-policy')?.slice(0, 34)}…`);
check('no server banner', !page.headers.get('x-powered-by'));

// unknown Api endpoint -> JSON, not the app shell
const unknown = await fetch(base + '/api/does-not-exist');
const unknownBody = await unknown.json().catch(() => ({}));
check('unknown API path answers JSON 404', unknown.status === 404 && unknownBody.error, unknownBody.error);

// unauthenticated access is refused on everything private
for (const path of ['/api/bootstrap', '/api/rooms', '/api/orders', '/api/admin/users', '/api/reports/summary', '/api/admin/audit']) {
  const r = await fetch(base + path);
  check(`no token → ${path} denied`, r.status === 401 || r.status === 403, `status ${r.status}`);
}

// a cashier cannot touch admin-only power
const cashier = (await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'cashier', pin: '1234' }) })).json()).token;
const adminTry = await fetch(base + '/api/admin/users', { method: 'POST', headers: { 'content-type': 'application/json', 'x-clove-token': cashier }, body: JSON.stringify({ name: 'Ghost', username: 'ghost', pin: '9999', role: 'admin' }) });
check('a cashier cannot create an admin account', adminTry.status === 403, `status ${adminTry.status}`);
const settingsTry = await fetch(base + '/api/admin/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-clove-token': cashier }, body: JSON.stringify({ hotel_name: 'Hacked' }) });
check('a cashier cannot change hotel settings', settingsTry.status === 403, `status ${settingsTry.status}`);

// bad token
const bad = await fetch(base + '/api/rooms', { headers: { 'x-clove-token': 'not-a-real-token' } });
check('a made-up token is refused', bad.status === 401 || bad.status === 403, `status ${bad.status}`);

// brute force: many wrong PINs get throttled, and a correct one still works afterwards
let throttled = false;
for (let i = 0; i < 20; i += 1) {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', pin: '0000' }) });
  if (r.status === 429) { throttled = true; break; }
}
check('guessing PINs gets rate limited', throttled);
const stillIn = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'manager', pin: '1234' }) });
check('other staff can still sign in while one username is paused', stillIn.status === 200, `status ${stillIn.status}`);
const lockedOut = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', pin: '1234' }) });
check('the attacked username is paused (PIN guessing stopped)', lockedOut.status === 429, `status ${lockedOut.status}`);

// SQL injection attempt through a search parameter is just a value, not code
const inj = await fetch(base + "/api/orders?status='%20OR%201=1--", { headers: { 'x-clove-token': cashier } });
check('SQL-ish input is handled as data', inj.status === 200, `status ${inj.status}`);

// mass assignment: extra fields are ignored, not stored
const rooms = await (await fetch(base + '/api/rooms', { headers: { 'x-clove-token': cashier } })).json();
const room = rooms.rooms[0];
const patch = await fetch(base + `/api/stays/${(await (await fetch(base + '/api/rooms', { headers: { 'x-clove-token': cashier } })).json()).rooms.find((r) => r.stay)?.stay.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-clove-token': cashier },
  body: JSON.stringify({ rate: 1234, status: 'checked_out', id: 'hacked', role: 'admin' }),
});
const patched = await patch.json();
check('mass assignment cannot flip a stay status or role', patched.stay?.status === 'active' && patched.stay?.rate === 1234, `status=${patched.stay?.status} rate=${patched.stay?.rate}`);

// uploads refuse anything that is not an image
const badUpload = await fetch(base + '/api/admin/uploads', { method: 'POST', headers: { 'content-type': 'application/json', 'x-clove-token': (await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'manager', pin: '1234' }) })).json()).token }, body: JSON.stringify({ data_url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', filename: 'evil.html' }) });
check('uploads refuse non-image payloads', badUpload.status === 400, `status ${badUpload.status}`);

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
