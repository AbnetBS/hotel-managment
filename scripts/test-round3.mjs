/**
 * API checks for the round-3 features.
 *
 *   guest requests · post-to-room · maintenance lifecycle · approvals
 *   inventory & recipes · lost & found · identity documents · currency
 *
 * Run against a live server:  npm run test:round3
 */
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const login = async (username) =>
  (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, pin: '1234' }) })).json()).token;

const api = async (token, path, init = {}) => {
  const response = await fetch(base + '/api' + path, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-clove-token': token, ...(init.headers || {}) },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

let pass = 0;
let fail = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

const cashier = await login('cashier');
const manager = await login('manager');
const admin = await login('admin');
const hk = await login('housekeeping');
const maintenance = await login('meron'); // the maintenance host's account

const rooms = (await api(manager, '/rooms')).body.rooms;
const busy = rooms.find((room) => room.status === 'occupied' && room.stay);
const free = rooms.find((room) => room.status === 'available');

/* ------------------------- 15. guest requests from QR --------------------- */

const guestRoom = (await (await fetch(`${base}/api/public/room/${busy.qr_token}`)).json());
check('the QR page offers more than food', (guestRoom.requestKinds || []).length >= 8, `${guestRoom.requestKinds?.length} kinds · e.g. ${guestRoom.requestKinds?.slice(0, 3).map((k) => k.label).join(', ')}`);

const towel = await (await fetch(`${base}/api/public/request/${busy.qr_token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'towel', note: 'Please bring 2 towels' }) })).json();
check('a guest can ask for towels from the room', towel.ok === true, towel.request ? `#${towel.request.id} → ${towel.request.department}` : 'failed');

const hkList = await api(hk, '/requests');
const towelRow = (hkList.body.requests || []).find((row) => row.id === towel.request?.id);
check('housekeeping sees the request on their screen', Boolean(towelRow), towelRow ? `${towelRow.label} · ${towelRow.status} · ${towelRow.note}` : 'missing');

await api(hk, `/requests/${towelRow.id}/advance`, { method: 'POST', body: '{}' });
const done = await api(hk, `/requests/${towelRow.id}/advance`, { method: 'POST', body: '{}' });
check('housekeeping accepts then finishes it', done.body.status === 'done', `status=${done.body.status}`);

const broken = await (await fetch(`${base}/api/public/request/${busy.qr_token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'maintenance', note: 'Air conditioner is not cooling' }) })).json();
const tickets = await api(maintenance, '/maintenance');
const ticket = (tickets.body.issues || tickets.body.maintenance || []).find((row) => row.issue?.includes('Air conditioner'));
check('“something is broken” opens a real maintenance ticket', Boolean(ticket), ticket ? `#${ticket.id} · ${ticket.priority}` : 'no ticket');

const checkoutAsk = await (await fetch(`${base}/api/public/request/${busy.qr_token}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'checkout' }) })).json();
check('a guest can ask to check out from the room', checkoutAsk.ok === true);

/* ------------------------------ 2. post to room --------------------------- */

const services = (await api(cashier, '/services')).body.services;
check('the hotel has a list of chargeable services', services.length >= 8, `${services.length} services · e.g. ${services.slice(0, 2).map((s) => s.name).join(', ')}`);

const laundry = services.find((s) => /laundry/i.test(s.name));
const charge = await api(cashier, `/stays/${busy.stay.id}/service`, { method: 'POST', body: JSON.stringify({ serviceId: laundry.id, amount: 240, qty: 2, note: '2 kg' }) });
check('laundry can be charged to the guest folio', charge.status === 200 && charge.body.etb > 0, `${charge.body.etb} ETB on the bill`);

const folio = await api(cashier, `/stays/${busy.stay.id}`);
check('it lands on the folio straight away', (folio.body.stay?.items || []).some((item) => item.description.includes('Laundry')), 'found on the folio');

/* --------------------------- 5. maintenance lifecycle --------------------- */

const lifecycle = {};
for (const [step, status] of [['assign', 'assigned'], ['start', 'in progress'], ['fix', 'fixed'], ['verify', 'verified']]) {
  const result = await api(maintenance, `/maintenance/${ticket.id}/move`, { method: 'POST', body: JSON.stringify({ status, assignee: 'Technician Yared', cost: 450 }) });
  lifecycle[step] = result.status === 200;
}
check('maintenance goes assigned → working → fixed → verified', Object.values(lifecycle).every(Boolean), Object.entries(lifecycle).map(([k, v]) => `${k}:${v ? 'ok' : 'x'}`).join(' '));

const verifiedTicket = (await api(manager, '/maintenance')).body.issues.find((row) => row.id === ticket.id);
check('verifying the repair closes the ticket with who signed it off', verifiedTicket.status === 'resolved' && verifiedTicket.verified_by, `#${verifiedTicket.id} → ${verifiedTicket.status} · ${verifiedTicket.verified_by} · cost ${verifiedTicket.cost}`);
const roomAfter = (await api(manager, '/rooms')).body.rooms.find((room) => room.id === ticket.room_id);
check('a repair in an occupied room never evicts the guest', roomAfter.status === 'occupied', `room ${roomAfter.number} still ${roomAfter.status} for ${roomAfter.stay?.guest_name}`);

const illegal = await api(maintenance, `/maintenance/${ticket.id}/move`, { method: 'POST', body: JSON.stringify({ status: 'assigned' }) });
check('illegal jumps in the lifecycle are refused', illegal.status === 400, illegal.body.error || '');

const history = await api(manager, `/maintenance/history/${ticket.room_id}`);
check('the room keeps a maintenance history', history.status === 200 && history.body.total >= 1, `${history.body.total} past issue(s)`);

/* ------------------------------- 8. approvals ----------------------------- */

const noApproval = await api(cashier, `/stays/${busy.stay.id}/payment`, { method: 'POST', body: JSON.stringify({ amount: 50, method: 'Cash' }) });
check('normal payments need no approval', noApproval.status === 200);

const needsIt = await api(cashier, '/approvals/needed?amount=5000&percent=40');
check('a big discount is flagged as needing approval', needsIt.body.needed === true);

const wrongPin = await api(cashier, '/approvals', { method: 'POST', body: JSON.stringify({ kind: 'discount', amount: 5000, managerUsername: 'manager', managerPin: '0000' }) });
check('a wrong manager PIN is refused', wrongPin.status === 400, wrongPin.body.error || '');

const cashierTries = await api(cashier, '/approvals', { method: 'POST', body: JSON.stringify({ kind: 'discount', amount: 5000, managerUsername: 'cashier', managerPin: '1234' }) });
check('another cashier cannot approve their own discount', cashierTries.status === 400, cashierTries.body.error || '');

const approved = await api(cashier, '/approvals', { method: 'POST', body: JSON.stringify({ kind: 'discount', amount: 5000, managerUsername: 'manager', managerPin: '1234', detail: 'Long-stay discount' }) });
check('a manager PIN grants the approval', approved.status === 200 && approved.body.approvedBy, approved.body.approvedBy || approved.body.error);

/* -------------------------- 11 + 12. inventory & recipes ------------------ */

const stock = await api(admin, '/admin/inventory');
check('the store room has stock', (stock.body.items || []).length >= 15, `${stock.body.items?.length} items`);
check('low stock is flagged', (stock.body.items || []).some((item) => item.low), (stock.body.items || []).filter((item) => item.low).map((item) => item.name).join(', '));
check('the forecast says what runs out soon', (stock.body.items || []).some((item) => item.days_left !== null), `${(stock.body.items || []).filter((i) => i.runs_out_soon).length} item(s) under 3 days`);

const recipe = await api(admin, '/admin/menu/mi-dorowat/recipe');
check('a dish has a recipe with a plate cost', recipe.status === 200 && (recipe.body.lines || []).length >= 3 && recipe.body.cost > 0,
  `${recipe.body.lines?.length} ingredient(s) · ${recipe.body.cost} ETB per plate`);

// an order finished by the kitchen must take stock off the shelf
const before = (await api(admin, '/admin/inventory')).body.items.find((item) => item.id === 'inv-chicken');
const menu = (await api(cashier, '/bootstrap')).body.menu.items.find((item) => /Doro wat/i.test(item.name));
const order = await api(cashier, '/orders', { method: 'POST', body: JSON.stringify({ roomId: busy.id, channel: 'outdoor', items: [{ menu_item_id: menu.id, qty: 2 }] }) });
const orderId = order.body.order.id;
const orderItems = (await api(cashier, '/orders')).body.orders.find((row) => row.id === orderId).items;
const kitchen = await login('kitchen');
await api(kitchen, `/order-items/${orderItems[0].id}/accept`, { method: 'POST', body: '{}' });
await api(kitchen, `/order-items/${orderItems[0].id}/done`, { method: 'POST', body: '{}' });
const after = (await api(admin, '/admin/inventory')).body.items.find((item) => item.id === 'inv-chicken');
check('finishing a dish takes its ingredients off the shelf', after.stock < before.stock,
  `chicken ${before.stock}kg → ${after.stock}kg (2 × Doro wat = 0.7kg)`);

const adjustment = await api(admin, '/admin/inventory/inv-water/move', { method: 'POST', body: JSON.stringify({ qty: 48, kind: 'in', note: 'Delivery' }) });
check('a delivery can be added to stock', adjustment.status === 200, `water now ${adjustment.body.stock}`);

const purchase = await api(admin, '/admin/inventory/purchase-requests', { method: 'POST', body: JSON.stringify({ inventory_item_id: 'inv-cream', qty: 10, note: 'Weekend cakes' }) });
check('a purchase request can be raised for a low item', purchase.status === 200);

/* ------------------------------- 16. lost & found ------------------------- */

const found = await api(cashier, '/lost-found');
check('lost & found has the demo items', (found.body.items || []).length >= 3, `${found.body.items?.length} item(s)`);

const newFound = await api(cashier, '/lost-found', { method: 'POST', body: JSON.stringify({ item: 'Blue jacket', location: 'Room 102 chair', roomId: busy.id, storage: 'Shelf C' }) });
const returned = await api(cashier, `/lost-found/${newFound.body.id}`, { method: 'POST', body: JSON.stringify({ status: 'returned', returnedTo: 'Selam Tesfaye' }) });
const list = await api(cashier, '/lost-found');
const jacket = (list.body.items || []).find((item) => item.id === newFound.body.id);
check('an item can be logged and returned to its owner', returned.status === 200 && jacket.status === 'returned', `${jacket?.item} → ${jacket?.status} to ${jacket?.returned_to}`);

/* --------------------------- 19. identity documents ----------------------- */

const guestId = busy.stay.guest_id || (await api(cashier, `/stays/${busy.stay.id}`)).body.stay.guest.id;
const upload = await api(cashier, `/guests/${guestId}/document`, { method: 'POST', body: JSON.stringify({ data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' }) });
check('an ID photo can be stored on the guest', upload.status === 200 && upload.body.url, upload.body.url || upload.body.error);

const viewer = await api(cashier, `/guests/${guestId}/document`);
check('the document is readable through the guarded endpoint', viewer.status === 200 && viewer.body.guest?.id_document_url, viewer.body.guest?.id_document_at?.slice(0, 16));

const purged = await api(admin, '/guests/purge-documents', { method: 'POST', body: JSON.stringify({ older_than_days: 0 }) });
check('documents can be purged by retention policy', purged.status === 200, `${purged.body.purged} removed`);

/* ------------------------------ currency / FX ----------------------------- */

const card = await api(admin, '/admin/fx');
check('the rate card is available to the desk', card.status === 200 && card.body.rates?.USD > 0, `source: ${card.body.source_label}`);

const manual = await api(admin, '/admin/fx/rates', { method: 'POST', body: JSON.stringify({ rates: { USD: 58.25, EUR: 63.4 } }) });
check('the manager can type today’s rates by hand', manual.status === 200 && manual.body.rates.USD === 58.25, `USD ${manual.body.rates.USD}`);

const refresh = await api(admin, '/fx/refresh', { method: 'POST', body: '{}' });
check('the official-rates button answers honestly either way', refresh.status === 200 && refresh.body.source_label,
  refresh.body.ok ? `official rates: ${refresh.body.rates.USD}` : `offline: ${refresh.body.error?.slice(0, 60)}`);

const publicRates = await (await fetch(`${base}/api/public/rates`)).json();
check('guests can see the rates too (read-only)', publicRates.rates?.USD > 0, publicRates.source_label);

// a guest pays in dollars and the bill is shown in dollars
const usdCheckin = await api(cashier, `/rooms/${free.id}/checkin`, {
  method: 'POST',
  body: JSON.stringify({
    guest: { full_name: 'Dollar Guest', phone: '+1 202 555 0134', id_type: 'Passport', id_number: 'P-9911' },
    currency: 'USD', fxRate: 58.25, billingMode: 'nightly', rate: 7600,
  }),
});
check('a guest can be checked in with a dollar bill', usdCheckin.status === 200 && usdCheckin.body.stayId, usdCheckin.body.error || `rate frozen at 58.25`);

const usdStay = (await api(cashier, `/stays/${usdCheckin.body.stayId}`)).body.stay;
check('the stay remembers the guest’s currency and rate', usdStay.currency === 'USD' && usdStay.fx_rate === 58.25, `${usdStay.currency} @ ${usdStay.fx_rate}`);

const guestBill = await (await fetch(`${base}/api/public/bill/${free.qr_token}`)).json();
check('the guest bill is quoted in dollars', guestBill.bill?.display?.currency === 'USD', guestBill.bill?.display ? `${guestBill.bill.display.total} (rate ${guestBill.bill.display.rate})` : 'no display block');

const dollarPayment = await api(cashier, `/stays/${usdCheckin.body.stayId}/payment`, {
  method: 'POST',
  body: JSON.stringify({ amount: 58.25, currency: 'USD', fxRate: 58.25, foreignAmount: 1, method: 'Cash' }),
});
check('a payment taken in dollars records both amounts', dollarPayment.status === 200);

const daySummary = (await api(admin, '/admin/fx')).body.today || [];
check('the manager sees foreign money by currency and rate', daySummary.some((row) => row.currency === 'USD'), daySummary.map((row) => `${row.currency} ${row.foreign} @ ${row.rate}`).join(' · ') || 'none yet');

/* ------------------- 8b. the discount guard at checkout ------------------- */

const bigDiscount = await api(cashier, `/stays/${usdCheckin.body.stayId}/checkout`, {
  method: 'POST',
  body: JSON.stringify({ unitsOverride: 1, discount: 4000, payments: [], release: false }),
});
check('a big discount cannot be taken without a manager', bigDiscount.status === 403 && bigDiscount.body.needs_approval === true,
  bigDiscount.body.error || `status ${bigDiscount.status}`);

const discountApproval = await api(cashier, '/approvals', {
  method: 'POST',
  body: JSON.stringify({ kind: 'discount', amount: 4000, managerUsername: 'manager', managerPin: '1234', detail: 'Goodwill' }),
});
const allowed = await api(cashier, `/stays/${usdCheckin.body.stayId}/checkout`, {
  method: 'POST',
  body: JSON.stringify({ unitsOverride: 1, discount: 4000, payments: [], release: false, approval_id: discountApproval.body.approvalId }),
});
check('with the manager’s approval the checkout goes through', allowed.status === 200 && allowed.body.ok === true, allowed.body.error || 'released');

const reused = await api(cashier, `/stays/${usdCheckin.body.stayId}/checkout`, {
  method: 'POST',
  body: JSON.stringify({ unitsOverride: 1, discount: 4000, payments: [], release: false, approval_id: discountApproval.body.approvalId }),
});
check('the same approval cannot be used twice', reused.body.duplicate === true || reused.status === 403, `status ${reused.status}`);

const folioAfter = (await api(cashier, `/stays/${usdCheckin.body.stayId}`)).body.stay;
const discountLine = (folioAfter.items || []).find((item) => item.kind === 'discount');
check('the folio says who allowed the discount', Boolean(discountLine) && /approved by/i.test(discountLine.description), discountLine?.description || 'no discount line');

/* ------------------------------- 20. branches ----------------------------- */

const branches = await api(admin, '/admin/branches');
check('the hotel group has its first branch', (branches.body.branches || []).length >= 1, (branches.body.branches || []).map((b) => `${b.name} (${b.code})`).join(', '));

const second = await api(admin, '/admin/branches', { method: 'POST', body: JSON.stringify({ name: 'Clove House · Hawassa', code: 'HW', address: 'Lake Road, Hawassa' }) });
check('a second branch can be added', second.status === 200 && second.body.id, second.body.id);

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
