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
const pastry = await login('pastry');
const hk = await login('housekeeping');

// 1. pastry is a real station
const boot = await api(pastry, '/bootstrap');
check('pastry station account loads its own board', boot.status === 200 && boot.body.user?.role === 'pastry', `role=${boot.body.user?.role}`);

// 2. pastry items exist and are routed to pastry
const menu = await api(cashier, '/bootstrap');
const pastryItems = (menu.body.menu?.items || []).filter((i) => i.station === 'pastry');
check('cake & pastry items are routed to the pastry station', pastryItems.length >= 5, `${pastryItems.length} items e.g. ${pastryItems[0]?.name}`);

// 3. an order with cake reaches pastry
const rooms = await api(cashier, '/rooms');
const busy = rooms.body.rooms.find((r) => r.status === 'occupied');
const cake = pastryItems.find((i) => /cake|croissant/i.test(i.name));
const order = await api(cashier, '/orders', { method: 'POST', body: JSON.stringify({ roomId: busy.id, channel: 'outdoor', items: [{ menu_item_id: cake.id, qty: 1 }] }) });
check('a cake order can be placed to a room', order.status === 200, `order #${order.body.order?.code} → station ${order.body.order?.items?.[0]?.station}`);
const orderId = order.body.order?.id;
await api(cashier, `/orders/${orderId}/accept`, { method: 'POST', body: JSON.stringify({ call_confirmed: true }) });
const sent = await api(cashier, `/orders/${orderId}/send`, { method: 'POST', body: '{}' });
check('the cake ticket is sent to the pastry station', sent.status === 200, `stations: ${sent.body.order?.stations?.join(', ')}`);

// 4. pastry sees and finishes it
const pastryBoard = await api(pastry, '/orders');
const ticket = (pastryBoard.body.orders || []).find((o) => o.id === orderId);
check('pastry board shows the ticket with its own item', !!ticket && ticket.items.length === 1, ticket ? `${ticket.items[0].name} · ${ticket.items[0].status}` : 'missing');
const itemId = ticket?.items?.[0]?.id;
await api(pastry, `/order-items/${itemId}/accept`, { method: 'POST', body: '{}' });
const done = await api(pastry, `/order-items/${itemId}/done`, { method: 'POST', body: '{}' });
check('pastry accept → done works', done.status === 200);

// 5. checkout → purple room + housekeeping alarm
const target = rooms.body.rooms.find((r) => r.status === 'occupied' && r.stay);
const checkout = await api(cashier, `/stays/${target.stay.id}/checkout`, { method: 'POST', body: JSON.stringify({ payments: [{ amount: 0, method: 'Cash' }], release: true }) });
check('checkout releases the room', checkout.status === 200);
const after = await api(cashier, '/rooms');
const released = after.body.rooms.find((r) => r.id === target.id);
check('the room turns purple (needs cleaning)', released.status === 'dirty', `status=${released.status}`);
const tasks = await api(hk, '/housekeeping');
const task = (tasks.body.tasks || []).find((t) => t.room_id === target.id && t.status !== 'completed');
check('housekeeping got a task for that room', !!task, task ? `${task.type} · ${task.status}` : 'missing');

// 6. housekeeper starts (blue) then finishes (green)
await api(hk, `/housekeeping/${task.id}/advance`, { method: 'POST', body: '{}' });
const mid = (await api(cashier, '/rooms')).body.rooms.find((r) => r.id === target.id);
check('starting the clean turns the room blue (cleaning)', mid.status === 'cleaning', `status=${mid.status}`);
const fin = await api(hk, `/housekeeping/${task.id}/advance`, { method: 'POST', body: '{}' });
const free = (await api(cashier, '/rooms')).body.rooms.find((r) => r.id === target.id);
check('finishing the clean turns the room green again', free.status === 'available', `status=${free.status}`);

// 7. the cashier can do it for a housekeeper with no phone, and mark "inspected"
// make another room dirty the honest way: check out a second guest
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

// 8. the guest sees the full bill (room + food + paid + balance)
const guestRoom = (await api(cashier, '/rooms')).body.rooms.find((r) => r.stay);
const guestBill = await (await fetch(`${base}/api/public/bill/${guestRoom.qr_token}`)).json();
check('the guest bill includes the room and the totals', !!guestBill.bill?.room && guestBill.bill.total > 0,
  guestBill.bill ? `room ${guestBill.bill.room.line} · total ${guestBill.bill.total} · balance ${guestBill.bill.balance}` : 'no bill');

// 9. reservations cannot double-book a room
const dateIn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dateOut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const freeRoom = (await api(cashier, '/rooms')).body.rooms.find((r) => r.status === 'available');
const first = await api(cashier, '/reservations', { method: 'POST', body: JSON.stringify({ guest_name: 'Booking One', room_id: freeRoom.id, arrival: dateIn, departure: dateOut }) });
const second2 = await api(cashier, '/reservations', { method: 'POST', body: JSON.stringify({ guest_name: 'Booking Two', room_id: freeRoom.id, arrival: dateIn, departure: dateOut }) });
check('a second booking on the same room and dates is refused', second2.status === 409,
  second2.body.error ? `${second2.body.error} alternatives: ${(second2.body.alternatives || []).join(', ') || 'none'}` : `status ${second2.status}`);

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
