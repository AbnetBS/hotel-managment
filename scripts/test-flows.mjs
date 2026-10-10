/** API-level checks. Run against a live server:   npm run test:api
 *  (the security suite deliberately pauses a username, so restart the server
 *   afterwards, or before a demo.)  */
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

/* ------------------------------ the two roles ----------------------------- */

const cashBoot = await api(cashier, '/bootstrap');
check('cashier signs in as the desk account', cashBoot.status === 200 && cashBoot.body.user?.role === 'cashier', `role=${cashBoot.body.user?.role}`);
const adminBoot = await api(admin, '/bootstrap');
check('admin signs in and gets the admin board', adminBoot.status === 200 && adminBoot.body.user?.role === 'admin', `role=${adminBoot.body.user?.role}`);

const menu = adminBoot.body.menu || {};
check('the menu has items and categories', (menu.items || []).length > 0 && (menu.categories || []).length > 0, `${menu.items?.length} items`);

/* ------------------------------ table ordering ---------------------------- */

const tables = (await api(cashier, '/tables')).body.tables || [];
check('the hotel has tables with unique QR tokens', tables.length > 0 && new Set(tables.map((t) => t.qr_token)).size === tables.length, `${tables.length} tables`);
const table = tables[0];

const publicMenu = await (await fetch(`${base}/api/public/menu/${table.qr_token}`)).json();
check('a table QR opens the menu with no room', Array.isArray(publicMenu.items) && publicMenu.table?.name === table.name, `table=${publicMenu.table?.name} items=${publicMenu.items?.length}`);

const food = publicMenu.items.find((i) => i.station === 'kitchen') || publicMenu.items[0];
const tableOrder = await (await fetch(`${base}/api/public/order/${table.qr_token}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ items: [{ menu_item_id: food.id, qty: 2 }] }),
})).json();
check('a table order is sent to the desk', Boolean(tableOrder.order?.code), `order #${tableOrder.order?.code} · ${tableOrder.order?.items} item(s)`);

const openList = (await api(cashier, '/orders')).body.orders || [];
const live = openList.find((o) => o.code === tableOrder.order?.code);
check('the order shows its table name on the desk board', live?.table_name === table.name, `label=${live?.table_name || live?.place}`);

const orderId = live?.id;
await api(cashier, `/orders/${orderId}/accept`, { method: 'POST', body: '{}' });
const ready = await api(cashier, `/orders/${orderId}/ready`, { method: 'POST', body: '{}' });
check('Food is up completes every line in one tap', ready.status === 200 && ready.body.order?.allDone, `status=${ready.body.order?.status} itemsDone=${ready.body.order?.items?.every((i) => i.status === 'done')}`);
const delivered = await api(cashier, `/orders/${orderId}/deliver`, { method: 'POST', body: '{}' });
check('delivering a table order marks it charged to the till', delivered.status === 200 && delivered.body.charged === false, `charged=${delivered.body.charged} (till)`);
const closed = await api(cashier, `/orders/${orderId}/close`, { method: 'POST', body: JSON.stringify({ paid_method: 'cash' }) });
check('the table order closes', closed.status === 200 && closed.body.order?.status === 'completed', `status=${closed.body.order?.status}`);

/* ------------------------------- receipt FS ------------------------------- */

const fs1 = await api(cashier, '/receipt/next-fs', { method: 'POST', body: '{}' });
const fs2 = await api(cashier, '/receipt/next-fs', { method: 'POST', body: '{}' });
check('each printed receipt takes the next FS number', fs1.status === 200 && fs2.status === 200 && fs1.body.fs !== fs2.body.fs, `${fs1.body.fs} → ${fs2.body.fs}`);

/* ------------------------------ room ordering ----------------------------- */

const rooms = await api(cashier, '/rooms');
const busy = rooms.body.rooms.find((r) => r.status === 'occupied');
const item = menu.items.find((i) => i.station === 'kitchen');
const order = await api(cashier, '/orders', { method: 'POST', body: JSON.stringify({ roomId: busy.id, channel: 'outdoor', items: [{ menu_item_id: item.id, qty: 1 }] }) });
check('a room order can be placed from the desk', order.status === 200, `order #${order.body.order?.code} → ${order.body.order?.place}`);
const roomOrderId = order.body.order?.id;
await api(cashier, `/orders/${roomOrderId}/accept`, { method: 'POST', body: JSON.stringify({ call_confirmed: true }) });
const sent = await api(cashier, `/orders/${roomOrderId}/send`, { method: 'POST', body: '{}' });
check('the ticket is sent to the station', sent.status === 200, `stations: ${sent.body.order?.stations?.join(', ')}`);
await api(cashier, `/orders/${roomOrderId}/ready`, { method: 'POST', body: '{}' });
const toRoom = await api(cashier, `/orders/${roomOrderId}/deliver`, { method: 'POST', body: '{}' });
check('delivering to a room charges the folio', toRoom.status === 200 && toRoom.body.charged === true, `charged=${toRoom.body.charged}`);

/* ---------------------- checkout + housekeeping (desk) --------------------- */

const target = rooms.body.rooms.find((r) => r.status === 'occupied' && r.stay);
const checkout = await api(cashier, `/stays/${target.stay.id}/checkout`, { method: 'POST', body: JSON.stringify({ payments: [{ amount: 0, method: 'Cash' }], release: true }) });
check('checkout releases the room', checkout.status === 200);
const after = await api(cashier, '/rooms');
const released = after.body.rooms.find((r) => r.id === target.id);
check('the room turns purple (needs cleaning)', released.status === 'dirty', `status=${released.status}`);
const tasks = (await api(cashier, '/housekeeping')).body.tasks || [];
const task = tasks.find((t) => t.room_id === target.id && t.status !== 'completed');
check('housekeeping got a task for that room', !!task, task ? `${task.type} · ${task.status}` : 'missing');

await api(cashier, `/housekeeping/${task.id}/advance`, { method: 'POST', body: '{}' });
const mid = (await api(cashier, '/rooms')).body.rooms.find((r) => r.id === target.id);
check('starting the clean turns the room blue (cleaning)', mid.status === 'cleaning', `status=${mid.status}`);
await api(cashier, `/housekeeping/${task.id}/advance`, { method: 'POST', body: '{}' });
const free = (await api(cashier, '/rooms')).body.rooms.find((r) => r.id === target.id);
check('finishing the clean turns the room green again', free.status === 'available', `status=${free.status}`);

const another = (await api(cashier, '/rooms')).body.rooms.find((r) => r.status === 'occupied' && r.stay && r.id !== target.id);
if (another) await api(cashier, `/stays/${another.stay.id}/checkout`, { method: 'POST', body: JSON.stringify({ payments: [{ amount: 0, method: 'Cash' }], release: true }) });
const second = (await api(cashier, '/rooms')).body.rooms.find((r) => r.status === 'dirty');
if (second) {
  const res = await api(cashier, `/rooms/${second.id}/cleaned`, { method: 'POST', body: JSON.stringify({ inspected: true }) });
  const now = (await api(cashier, '/rooms')).body.rooms.find((r) => r.id === second.id);
  check('the cashier can mark a room cleaned from her own screen', res.status === 200 && now.status === 'inspected', `status=${now.status}`);
} else {
  check('the cashier can mark a room cleaned from her own screen', false, 'no dirty room available');
}

/* ------------------------------- guest bill ------------------------------- */

const guestRoom = (await api(cashier, '/rooms')).body.rooms.find((r) => r.stay);
const guestBill = await (await fetch(`${base}/api/public/bill/${guestRoom.qr_token}`)).json();
check('the guest bill includes the room and the totals', !!guestBill.bill?.room && guestBill.bill.total > 0,
  guestBill.bill ? `room ${guestBill.bill.room.line} · total ${guestBill.bill.total} · balance ${guestBill.bill.balance}` : 'no bill');

/* ------------------------------- reservations ----------------------------- */

const dateIn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dateOut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const freeRoom = (await api(cashier, '/rooms')).body.rooms.find((r) => r.status === 'available');
const first = await api(cashier, '/reservations', { method: 'POST', body: JSON.stringify({ guest_name: 'Booking One', room_id: freeRoom.id, arrival: dateIn, departure: dateOut }) });
const second2 = await api(cashier, '/reservations', { method: 'POST', body: JSON.stringify({ guest_name: 'Booking Two', room_id: freeRoom.id, arrival: dateIn, departure: dateOut }) });
check('a second booking on the same room and dates is refused', second2.status === 409,
  second2.body.error ? `${second2.body.error} alternatives: ${(second2.body.alternatives || []).join(', ') || 'none'}` : `status ${second2.status}`);

/* ------------------- duplicate protection (dropped connection) ------------- */

const dupRoom = (await api(cashier, '/rooms')).body.rooms.find((r) => r.stay);
const dupRef = 'test-ref-' + Date.now();

const p1 = await api(cashier, `/stays/${dupRoom.stay.id}/payment`, { method: 'POST', body: JSON.stringify({ amount: 100, method: 'Cash', client_ref: dupRef }) });
const p2 = await api(cashier, `/stays/${dupRoom.stay.id}/payment`, { method: 'POST', body: JSON.stringify({ amount: 100, method: 'Cash', client_ref: dupRef }) });
check('a retried payment is stored once', p1.status === 200 && p2.status === 200 && p2.body.duplicate === true, `second reply duplicate=${p2.body.duplicate}`);

const dupMenu = (await api(cashier, '/bootstrap')).body.menu.items.find((i) => i.station === 'kitchen');
const orderRef = 'test-order-' + Date.now();
const o1 = await api(cashier, '/orders', { method: 'POST', body: JSON.stringify({ roomId: dupRoom.id, channel: 'outdoor', client_ref: orderRef, items: [{ menu_item_id: dupMenu.id, qty: 1 }] }) });
const o2 = await api(cashier, '/orders', { method: 'POST', body: JSON.stringify({ roomId: dupRoom.id, channel: 'outdoor', client_ref: orderRef, items: [{ menu_item_id: dupMenu.id, qty: 1 }] }) });
check('a double-tapped order is created once', o1.status === 200 && o1.body.order.code === o2.body.order.code, `${o1.body.order?.code} = ${o2.body.order?.code}`);

const checkoutRef = 'test-checkout-' + Date.now();
const c1 = await api(cashier, `/stays/${dupRoom.stay.id}/checkout`, { method: 'POST', body: JSON.stringify({ client_ref: checkoutRef, release: true, payments: [] }) });
const c2 = await api(cashier, `/stays/${dupRoom.stay.id}/checkout`, { method: 'POST', body: JSON.stringify({ client_ref: checkoutRef, release: true, payments: [] }) });
check('checking out twice is safe', c1.status === 200 && c2.status === 200 && c2.body.duplicate === true, `second reply duplicate=${c2.body.duplicate}`);

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
