/**
 * Owner overview resilience.  Run against a live server:  npm run test:overview
 *
 * A room can read "occupied" after its bill is closed but before housekeeping
 * releases it — there is no active stay then.  The owner's overview used to
 * crash on that (room.stay / room.totals were null).  This proves the API
 * produces exactly that shape and that the owner endpoints never throw on it.
 */
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const login = async (u) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, pin: '1234' }) })).json()).token;
const api = async (t, path, init = {}) => {
  const r = await fetch(base + '/api' + path, { ...init, headers: { 'content-type': 'application/json', 'x-clove-token': t, ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
let pass = 0, fail = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`); ok ? pass++ : fail++; };

const cashier = await login('cashier');
const admin = await login('admin');

// Check a guest into a free room.
const rooms = await api(cashier, '/rooms');
const free = rooms.body.rooms?.find((r) => r.status === 'available');
check('a free room is available for the test', Boolean(free), free?.number || 'none');

const checkin = await api(cashier, `/rooms/${free.id}/checkin`, { method: 'POST', body: JSON.stringify({ guest: { full_name: 'Overview Regression', phone: '0900123456' }, rate: 1000 }) });
const stayId = checkin.body.stayId;
check('the guest is checked in', checkin.status === 200 && Boolean(stayId), stayId || checkin.body.error);

// Close the bill but do NOT release the room (release: false).
const closed = await api(cashier, `/stays/${stayId}/checkout`, { method: 'POST', body: JSON.stringify({ release: false, payments: [{ amount: 1000, method: 'Cash' }] }) });
check('the bill is closed without releasing the room', closed.status === 200 && closed.body.ok, closed.body.error || 'ok');

// The room is now "occupied" with no active stay — the exact crash shape.
const after = await api(admin, '/rooms');
const room = after.body.rooms?.find((r) => r.id === free.id);
check('the room reads occupied but carries no active stay', room?.status === 'occupied' && room?.stay === null && room?.totals === null, `status=${room?.status} stay=${room?.stay}`);

// Owner endpoints must answer 200, never crash, on that data.
const summary = await api(admin, '/reports/summary');
check('owner reports/summary still loads', summary.status === 200 && summary.body.snapshot, `status ${summary.status}`);
const boot = await api(admin, '/bootstrap');
const bootRoom = boot.body.rooms?.find((r) => r.id === free.id);
check('bootstrap includes the stay-less occupied room without error', boot.status === 200 && bootRoom && bootRoom.stay === null, `status ${boot.status}`);

// Server is still up afterwards.
const health = await fetch(`${base}/api/health`);
check('the server stayed up', health.status === 200, `status ${health.status}`);

// Tidy up: send the room to housekeeping so the demo stays sane.
await api(cashier, `/rooms/${free.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'dirty' }) });

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
