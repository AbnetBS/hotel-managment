import { db, audit, id, nowIso } from './db.js';
import { computeRoomCharge, folioTotals } from '../shared/billing.js';
import { logEvent, nextOrderCode, orderView, menu } from './repo.js';
import { publish, publishToRoles } from './realtime.js';
import { consumeRecipe } from './ops.js';

const STAY_CODE_START = 4101;

export function nextStayCode() {
  const row = db.prepare("SELECT MAX(CAST(SUBSTR(code, 4) AS INTEGER)) AS max FROM stays WHERE code LIKE 'ST-%'").get();
  const base = row?.max && row.max >= STAY_CODE_START ? row.max : STAY_CODE_START;
  return `ST-${base + 1}`;
}

export function roomById(roomId) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
}

export function activeStayForRoom(roomId) {
  return db.prepare("SELECT * FROM stays WHERE room_id = ? AND status = 'active' ORDER BY check_in_at DESC").get(roomId);
}

export function rateForRoom(type, billingMode) {
  if (!type) return 0;
  if (billingMode === 'hourly') return type.hourly_rate || Math.round(type.nightly_rate / 6);
  if (billingMode === 'dayuse') return type.dayuse_rate || Math.round(type.nightly_rate / 1.5);
  return type.nightly_rate || 0;
}

/** Find an existing guest with the same phone (or name) so we never double-file people. */
function findGuestByPhone(phone, fullName) {
  if (phone) {
    const row = db.prepare('SELECT * FROM guests WHERE phone = ?').get(String(phone).trim());
    if (row) return row;
  }
  if (!fullName) return null;
  return db.prepare('SELECT * FROM guests WHERE lower(full_name) = lower(?)').get(String(fullName).trim()) || null;
}

export function createGuest(fields, { source = 'cashier', actor } = {}) {
  const flat = { ...fields };
  const known = ['full_name', 'phone', 'email', 'nationality', 'id_type', 'id_number'];
  const extra = {};
  for (const [key, value] of Object.entries(flat)) {
    if (!known.includes(key) && value !== '' && value != null) extra[key] = value;
  }
  const gid = id('g');
  db.prepare(`INSERT INTO guests (id, full_name, phone, email, nationality, id_type, id_number, extra, created_at, created_by, source)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    gid,
    String(flat.full_name || 'Walk-in guest').trim(),
    flat.phone || null,
    flat.email || null,
    flat.nationality || null,
    flat.id_type || null,
    flat.id_number || null,
    JSON.stringify(extra),
    nowIso(),
    actor?.id || null,
    source,
  );
  return { id: gid, ...flat, extra };
}

/** Check a guest into a room (cashier, or an approved QR registration). */
export function checkInRoom({ roomId, guest: guestFields, guestId, billingMode, rate, deposit, method, currency, fxRate, expectedOutAt, adults, children, note, source = 'cashier', actor }) {
  const room = roomById(roomId);
  if (!room) return { error: 'Room not found.' };
  if (activeStayForRoom(roomId)) return { error: `Room ${room.number} already has an active guest.` };
  if (['maintenance', 'blocked'].includes(room.status)) return { error: `Room ${room.number} is blocked for ${room.status}. Release it first.` };

  const type = db.prepare('SELECT * FROM room_types WHERE id = ?').get(room.room_type_id);
  const mode = billingMode || room.billing_mode || type?.billing_mode || 'nightly';
  const finalRate = Number(rate) || rateForRoom(type, mode);
  const graceSetting = db.prepare("SELECT value FROM settings WHERE key = 'grace_hours'").get();
  const graceHours = graceSetting ? Number(graceSetting.value) : 1;

  let guest = guestId ? db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId) : null;
  if (!guest && guestFields) {
    guest = findGuestByPhone(guestFields.phone, guestFields.full_name);
    if (guest) {
      db.prepare('UPDATE guests SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), nationality = COALESCE(?, nationality) WHERE id = ?')
        .run(guestFields.full_name || null, guestFields.email || null, guestFields.nationality || null, guest.id);
    } else {
      guest = createGuest(guestFields, { source, actor });
    }
  }
  if (!guest) return { error: 'Guest details are required.' };

  // The guest's money: frozen on the stay so the whole bill is quoted in it.
  const billCurrency = String(currency || 'ETB').toUpperCase();
  const billRate = billCurrency === 'ETB' ? 1 : Number(fxRate) || null;
  if (billCurrency !== 'ETB' && !billRate) return { error: `No exchange rate is set for ${billCurrency}. Refresh the official rates first.` };

  const checkInAt = nowIso();
  const defaultOutHours = mode === 'nightly' ? 24 : mode === 'dayuse' ? (type?.dayuse_hours || 3) : 1;
  const sid = id('stay');
  db.prepare(`INSERT INTO stays (id, code, guest_id, room_id, billing_mode, rate, dayuse_hours, grace_hours, check_in_at, expected_out_at,
      status, discount, adults, children, source, note, currency, fx_rate, branch_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    sid, nextStayCode(), guest.id, roomId, mode, finalRate, type?.dayuse_hours || 3, graceHours, checkInAt,
    expectedOutAt || new Date(Date.now() + defaultOutHours * 3600 * 1000).toISOString(),
    Number(adults) || 1, Number(children) || 0, source, note || null, billCurrency, billRate,
    room.branch_id || null, actor?.id || null, checkInAt, checkInAt,
  );

  if (Number(deposit) > 0) {
    postFolioItem({
      stayId: sid, kind: 'payment', description: `Deposit · ${method || 'Cash'}`,
      amount: -Math.abs(Number(deposit)), method: method || 'Cash', actor,
    });
  }

  db.prepare('UPDATE rooms SET status = ?, block_reason = NULL WHERE id = ?').run('occupied', roomId);
  audit({ actor, action: 'check-in', entity: 'stay', entityId: sid, detail: `${guest.full_name} → Room ${room.number} (${mode} @ ${finalRate})` });
  publish(['rooms', 'stays', 'folios', 'reports']);
  return { stayId: sid, guestId: guest.id, room: room.number };
}

export function postFolioItem({ stayId, kind, description, qty = 1, unitPrice = 0, amount, station, orderId, method, reference, clientRef, currency, fxRate, foreignAmount, actor, at }) {
  // Same device reference already posted? Return the original line, never a second one.
  if (clientRef) {
    const seen = db.prepare('SELECT id FROM folio_items WHERE client_ref = ?').get(clientRef);
    if (seen) return seen.id;
  }
  const value = amount !== undefined ? Number(amount) : Number(qty) * Number(unitPrice);
  const itemId = id('fi');
  const when = at || nowIso();
  const stayRow = db.prepare('SELECT branch_id FROM stays WHERE id = ?').get(stayId);
  db.prepare(`INSERT INTO folio_items (id, stay_id, kind, description, qty, unit_price, amount, station, order_id, method, reference, client_ref,
                currency, fx_rate, foreign_amount, branch_id, bill_date, void, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`).run(
    itemId, stayId, kind, description, Number(qty) || 1, Number(unitPrice) || 0, value, station || null, orderId || null,
    method || null, reference || null, clientRef || null,
    currency || null, fxRate || null, foreignAmount || null, stayRow?.branch_id || null,
    when.slice(0, 10), when, actor?.id || null,
  );
  return itemId;
}

export function takePayment({ stayId, amount, method, reference, clientRef, currency, fxRate, foreignAmount, actor }) {
  const value = Math.abs(Number(amount) || 0);
  if (!value) return { error: 'Enter the amount received.' };
  if (clientRef && db.prepare('SELECT id FROM folio_items WHERE client_ref = ?').get(clientRef)) {
    // The device retried after a dropped connection: the money is already in.
    return { ok: true, duplicate: true };
  }
  postFolioItem({
    stayId, kind: 'payment', method: method || 'Cash', reference, clientRef, actor,
    currency: currency && currency !== 'ETB' ? currency : null,
    fxRate: currency && currency !== 'ETB' ? fxRate : null,
    foreignAmount: currency && currency !== 'ETB' ? foreignAmount : null,
    description: `Payment · ${method || 'Cash'}${reference ? ` · ${reference}` : ''}${currency && currency !== 'ETB' ? ` · ${currency} @ ${fxRate}` : ''}`,
    amount: -value,
  });
  audit({ actor, action: 'payment', entity: 'stay', entityId: stayId, detail: `${value} via ${method || 'Cash'}${reference ? ` · ${reference}` : ''}` });
  publish(['folios', 'stays', 'rooms', 'reports']);
  return { ok: true };
}

/** Paid & release: freeze the room charge, take the money, free the room, notify housekeeping. */
export function checkOutStay({ stayId, unitsOverride, discount, payments = [], release = true, note, clientRef, actor }) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) return { error: 'Stay not found.' };
  if (stay.status !== 'active') {
    // Already released (the cashier's tablet retried): report the same numbers.
    const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stayId);
    return { ok: true, duplicate: true, totals: folioTotals(stay, items), room: roomById(stay.room_id)?.number };
  }
  const room = roomById(stay.room_id);

  const checkoutAt = nowIso();
  const charge = computeRoomCharge({ ...stay, units_override: unitsOverride ?? stay.units_override, check_out_at: checkoutAt });

  const hasPostedRoom = db.prepare("SELECT COUNT(*) AS n FROM folio_items WHERE stay_id = ? AND kind = 'room' AND void = 0").get(stayId).n > 0;
  const roomLine = `Room charge · ${charge.billedUnits} ${charge.billedUnits === 1 ? charge.unitLabel : charge.unitLabelPlural} @ ${charge.rate}`;
  if (hasPostedRoom) {
    db.prepare("UPDATE folio_items SET description = ?, amount = ? WHERE stay_id = ? AND kind = 'room' AND void = 0").run(roomLine, charge.amount, stayId);
  } else {
    postFolioItem({ stayId, kind: 'room', description: roomLine, amount: charge.amount, clientRef: clientRef ? `${clientRef}:room` : undefined, actor });
  }

  const discountValue = Math.abs(Number(discount) || 0);
  if (discountValue > 0) {
    postFolioItem({ stayId, kind: 'discount', description: 'Discount · approved at checkout', amount: -discountValue, actor });
  }

  payments.forEach((payment, index) => {
    const value = Math.abs(Number(payment.amount) || 0);
    if (!value) return;
    postFolioItem({
      stayId, kind: 'payment', method: payment.method || 'Cash', reference: payment.reference, actor,
      clientRef: clientRef ? `${clientRef}:p${index}` : undefined,
      description: `Settle bill · ${payment.method || 'Cash'}`, amount: -value,
    });
  });

  db.prepare(`UPDATE stays SET status = 'checked_out', check_out_at = ?, units_override = ?, discount = discount + ?, updated_at = ? WHERE id = ?`)
    .run(checkoutAt, charge.billedUnits, discountValue, checkoutAt, stayId);

  if (release && room) {
    db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run('dirty', room.id);
    const taskId = id('hk');
    db.prepare(`INSERT INTO housekeeping_tasks (id, room_id, type, assignee, priority, status, note, created_at)
                VALUES (?, ?, 'Turnover clean · checkout', 'Unassigned', 'high', 'pending', ?, ?)`)
      .run(taskId, room.id, note || `Guest left at ${new Date(checkoutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, checkoutAt);
    // The room turns purple on every board and the cleaning alarm rings.
    ringForCleaning({ room, taskId, reason: 'checkout' });
  }

  const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stayId);
  const totals = folioTotals({ ...stay, check_out_at: checkoutAt, units_override: charge.billedUnits }, items);
  audit({ actor, action: 'check-out', entity: 'stay', entityId: stayId, detail: `Room ${room?.number} released · total ${totals.total} · balance ${totals.balance}` });
  publish(['rooms', 'stays', 'folios', 'housekeeping', 'reports']);
  return { ok: true, totals, units: charge.billedUnits, room: room?.number };
}

/* -------------------------------- orders ---------------------------------- */

export function createOrder({ roomId, stayId, channel = 'outdoor', items = [], note, guestName, clientRef, actor }) {
  if (clientRef) {
    const seen = db.prepare('SELECT * FROM orders WHERE client_ref = ?').get(clientRef);
    // The guest's phone sent this already (bad signal, double tap): send back the same order.
    if (seen) return { order: orderView(seen.id), duplicate: true };
  }
  const menuData = menu();
  const lines = [];
  for (const raw of items) {
    const menuItem = menuData.items.find((m) => m.id === raw.menu_item_id);
    if (!menuItem) continue;
    const qty = Math.max(1, Number(raw.qty) || 1);
    lines.push({
      menu_item_id: menuItem.id, name: menuItem.name, name_am: menuItem.name_am, qty,
      unit_price: Number(raw.unit_price ?? menuItem.price), station: menuItem.station, note: raw.note || null,
    });
  }
  if (!lines.length) return { error: 'Add at least one item.' };

  let stay = stayId ? db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId) : null;
  let room = roomId ? roomById(roomId) : null;
  if (!stay && room) stay = activeStayForRoom(room.id);
  if (!room && stay) room = roomById(stay.room_id);

  const isCounter = channel === 'counter';
  if (!isCounter && !stay) {
    return { error: 'That room has no active guest. Check the guest in first, or take a walk-in order.' };
  }

  const total = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);
  const orderId = id('o');
  const code = nextOrderCode();
  const createdAt = nowIso();
  const guestRow = stay ? db.prepare('SELECT * FROM guests WHERE id = ?').get(stay.guest_id) : null;

  db.prepare(`INSERT INTO orders (id, code, room_id, stay_id, guest_name, channel, status, note, total, call_confirmed, charged, client_ref, branch_id, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, 0, 0, ?, ?, ?, ?)`).run(
    orderId, code, room?.id || null, stay?.id || null,
    guestName || guestRow?.full_name || (isCounter ? 'Walk-in guest' : 'In-house guest'),
    channel, note || null, total, clientRef || null, room?.branch_id || null, createdAt, actor?.id || 'guest-qr',
  );

  const insertItem = db.prepare(`INSERT INTO order_items (id, order_id, menu_item_id, name, name_am, qty, unit_price, station, status, note)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`);
  for (const line of lines) {
    insertItem.run(id('oi'), orderId, line.menu_item_id, line.name, line.name_am, line.qty, line.unit_price, line.station, line.note);
  }

  const channelLabel = channel === 'qr' ? 'QR order from room' : channel === 'outdoor' ? 'Phone / room-service order' : 'Counter order';
  logEvent(orderId, actor?.name || (channel === 'qr' ? `Room ${room?.number} guest (QR)` : 'Cashier'), 'created', `${channelLabel} · #${code}`);

  const view = orderView(orderId);
  publish(['orders', 'rooms']);
  publishToRoles(['cashier', 'admin', 'manager'], {
    type: 'alert',
    kind: 'order.new',
    title: room ? `New order · Room ${room.number}` : 'New counter order',
    order: view,
    at: Date.now(),
  });
  return { order: view };
}

export function acceptOrder({ orderId, callConfirmed, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status !== 'new') return { error: `Order #${order.code} was already accepted.` };
  db.prepare("UPDATE orders SET status = 'accepted', accepted_at = ?, accepted_by = ?, call_confirmed = ? WHERE id = ?")
    .run(nowIso(), actor?.id || null, callConfirmed ? 1 : 0, orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'accepted', callConfirmed ? 'Accepted · guest confirmed by phone' : 'Accepted at the cashier desk');
  publish(['orders']);
  return { order: orderView(orderId) };
}

export function confirmCall({ orderId, actor }) {
  db.prepare('UPDATE orders SET call_confirmed = 1 WHERE id = ?').run(orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'confirmed', 'Guest confirmed the order by phone');
  publish(['orders']);
  return { order: orderView(orderId) };
}

export function sendOrderToStations({ orderId, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (['sent', 'ready', 'delivering', 'delivered', 'completed'].includes(order.status)) {
    return { error: `Order #${order.code} is already with the stations.` };
  }
  if (order.status === 'new') return { error: 'Accept the order first, then confirm it with the guest.' };
  db.prepare("UPDATE orders SET status = 'sent', sent_at = ? WHERE id = ?").run(nowIso(), orderId);
  const stations = [...new Set(db.prepare('SELECT station FROM order_items WHERE order_id = ?').all(orderId).map((r) => r.station))].filter(Boolean);
  logEvent(orderId, actor?.name || 'Cashier', 'sent', `Sent to ${stations.join(', ')}`);
  const view = orderView(orderId);
  publish(['orders']);
  publishToRoles(stations, { type: 'alert', kind: 'order.sent', title: `New ticket · order #${order.code}`, order: view, at: Date.now() });
  return { order: view };
}

export function acceptOrderItem({ itemId, actor }) {
  const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
  if (!item) return { error: 'Item not found.' };
  db.prepare("UPDATE order_items SET status = 'cooking', accepted_at = COALESCE(accepted_at, ?) WHERE id = ?").run(nowIso(), itemId);
  logEvent(item.order_id, actor?.name || 'Station', 'item-accepted', `${item.name} × ${item.qty} accepted`);
  publish(['orders']);
  return { order: orderView(item.order_id) };
}

export function completeOrderItem({ itemId, actor }) {
  const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
  if (!item) return { error: 'Item not found.' };
  db.prepare("UPDATE order_items SET status = 'done', done_at = ? WHERE id = ?").run(nowIso(), itemId);
  logEvent(item.order_id, actor?.name || 'Station', 'item-done', `${item.name} × ${item.qty} ready`);
  // Stock follows the plate: the recipe of this dish leaves the shelf now.
  if (item.menu_item_id) {
    const order = db.prepare('SELECT code FROM orders WHERE id = ?').get(item.order_id);
    consumeRecipe({ menuItemId: item.menu_item_id, qty: item.qty, reference: order?.code || item.order_id, actor });
  }
  let order = orderView(item.order_id);
  if (order?.allDone && !['ready', 'delivering', 'delivered', 'completed'].includes(order.status)) {
    db.prepare("UPDATE orders SET status = 'ready', ready_at = ? WHERE id = ?").run(nowIso(), item.order_id);
    logEvent(item.order_id, 'System', 'ready', 'All items ready — cashier can send the waiter');
    order = orderView(item.order_id);
    publishToRoles(['cashier', 'waiter', 'admin', 'manager'], {
      type: 'alert', kind: 'order.ready', title: `Ready to deliver · order #${order.code} · Room ${order.room_number}`, order, at: Date.now(),
    });
  }
  publish(['orders']);
  return { order };
}

export function sendWaiter({ orderId, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status !== 'ready') return { error: `Order #${order.code} is not ready for delivery yet.` };
  db.prepare("UPDATE orders SET status = 'delivering', delivering_at = ? WHERE id = ?").run(nowIso(), orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'waiter-sent', 'Waiter sent to deliver to the room');
  const view = orderView(orderId);
  publish(['orders']);
  publishToRoles(['waiter', 'admin', 'manager', 'cashier'], {
    type: 'alert', kind: 'order.delivering', title: `Deliver now · order #${order.code} · Room ${view.room_number}`, order: view, at: Date.now(),
  });
  return { order: view };
}

export function deliverOrder({ orderId, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (['delivered', 'completed'].includes(order.status)) return { order: orderView(orderId) };
  db.prepare("UPDATE orders SET status = 'delivered', delivered_at = ?, delivered_by = ? WHERE id = ?").run(nowIso(), actor?.id || null, orderId);
  logEvent(orderId, actor?.name || 'Waiter', 'delivered', 'Delivered to the room');
  const charge = chargeOrderToFolio({ orderId, actor });
  const view = orderView(orderId);
  publish(['orders', 'folios', 'rooms', 'stays', 'reports']);
  publishToRoles(['cashier', 'admin', 'manager'], {
    type: 'alert', kind: 'order.delivered',
    title: `Order #${view.code} delivered · ${charge?.charged ? 'added to the room bill' : 'pay at the till'}`,
    order: view, at: Date.now(),
  });
  return { order: view, charged: !!charge?.charged };
}

/** Put a delivered order on the guest's bill. Safe to call twice. */
export function chargeOrderToFolio({ orderId, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.charged) return { charged: false, reason: 'already charged' };
  if (!order.stay_id) {
    db.prepare('UPDATE orders SET charged = 1 WHERE id = ?').run(orderId);
    logEvent(orderId, actor?.name || 'Cashier', 'charged', 'Walk-in order collected at the till');
    return { charged: false, reason: 'no room folio' };
  }
  for (const item of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId)) {
    postFolioItem({
      stayId: order.stay_id, kind: 'food', station: item.station, orderId,
      description: `${item.name} × ${item.qty} · order #${order.code}`,
      qty: item.qty, unitPrice: item.unit_price, actor,
    });
  }
  db.prepare('UPDATE orders SET charged = 1 WHERE id = ?').run(orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'charged', `Charged ${order.total} to the room folio`);
  publish(['folios', 'stays', 'rooms', 'reports']);
  return { charged: true };
}

export function closeOrder({ orderId, paidMethod, actor }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'new') return { error: 'Accept the order before closing it.' };
  if (order.stay_id && !order.charged && ['delivered', 'ready', 'delivering'].includes(order.status)) {
    chargeOrderToFolio({ orderId, actor });
  }
  db.prepare("UPDATE orders SET status = 'completed', closed_at = ? WHERE id = ?").run(nowIso(), orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'closed', paidMethod ? `Paid at the till · ${paidMethod}` : 'Closed');
  publish(['orders', 'reports']);
  return { order: orderView(orderId) };
}

export function cancelOrder({ orderId, reason, actor }) {
  db.prepare("UPDATE orders SET status = 'cancelled', closed_at = ?, cancel_reason = ? WHERE id = ?").run(nowIso(), reason || 'Cancelled', orderId);
  logEvent(orderId, actor?.name || 'Cashier', 'cancelled', reason || 'Cancelled');
  publish(['orders']);
  return { order: orderView(orderId) };
}

/* --------------------- rooms, housekeeping, maintenance ------------------- */

export function setRoomStatus({ roomId, status, note, actor }) {
  const room = roomById(roomId);
  if (!room) return { error: 'Room not found.' };
  const active = activeStayForRoom(roomId);
  if (active && ['available', 'cleaning', 'dirty'].includes(status)) {
    return { error: `Room ${room.number} still has a guest checked in. Pay & release first.` };
  }
  db.prepare('UPDATE rooms SET status = ?, block_reason = ? WHERE id = ?').run(status, status === 'maintenance' ? note || 'Blocked' : null, roomId);
  audit({ actor, action: 'room-status', entity: 'room', entityId: roomId, detail: `${room.number} → ${status}${note ? ` (${note})` : ''}` });
  publish(['rooms', 'housekeeping', 'reports']);
  return { ok: true };
}

export function advanceHousekeeping({ taskId, actor }) {
  const task = db.prepare('SELECT * FROM housekeeping_tasks WHERE id = ?').get(taskId);
  if (!task) return { error: 'Task not found.' };
  const room = roomById(task.room_id);
  const next = task.status === 'pending' ? 'in progress' : 'completed';
  db.prepare("UPDATE housekeeping_tasks SET status = ?, assignee = COALESCE(NULLIF(?, ''), assignee), completed_at = ?, started_at = COALESCE(started_at, ?) WHERE id = ?")
    .run(next, actor?.name || '', next === 'completed' ? nowIso() : null, nowIso(), taskId);

  if (next === 'in progress' && room && ['dirty', 'cleaning'].includes(room.status)) {
    db.prepare("UPDATE rooms SET status = 'cleaning' WHERE id = ?").run(room.id);
    publishToRoles(['cashier', 'manager', 'admin'], {
      type: 'alert', kind: 'room.cleaning', room: room.number, room_id: room.id,
      title: `Room ${room.number} — housekeeping started cleaning`, at: Date.now(),
    });
  }
  if (next === 'completed' && room && ['dirty', 'cleaning'].includes(room.status)) {
    db.prepare("UPDATE rooms SET status = 'available' WHERE id = ?").run(room.id);
    publishToRoles(['cashier', 'manager', 'admin'], {
      type: 'alert', kind: 'room.clean', room: room.number, room_id: room.id,
      title: `Room ${room.number} is clean — ready to sell`, at: Date.now(),
    });
  }
  audit({ actor, action: 'housekeeping', entity: 'room', entityId: task.room_id, detail: `${task.type} → ${next}` });
  publish(['housekeeping', 'rooms', 'reports']);
  return { ok: true, status: next, room: room?.number };
}

/**
 * Mark a room clean straight from the board — the cashier does this when the
 * housekeeper has no phone and simply tells her the room is finished.
 */
export function markRoomCleaned({ roomId, inspected = false, note, actor }) {
  const room = roomById(roomId);
  if (!room) return { error: 'Room not found.' };
  if (activeStayForRoom(roomId)) return { error: `Room ${room.number} still has a guest in it.` };
  const status = inspected ? 'inspected' : 'available';
  db.prepare('UPDATE rooms SET status = ?, block_reason = NULL, cleaned_at = ?, cleaned_by = ? WHERE id = ?')
    .run(status, nowIso(), actor?.name || null, roomId);
  db.prepare("UPDATE housekeeping_tasks SET status = 'completed', completed_at = ?, assignee = COALESCE(NULLIF(?, ''), assignee) WHERE room_id = ? AND status != 'completed'")
    .run(nowIso(), actor?.name || '', roomId);
  audit({ actor, action: inspected ? 'room-inspected' : 'room-cleaned', entity: 'room', entityId: roomId, detail: `${room.number} → ${status}${note ? ` (${note})` : ''}` });
  publish(['housekeeping', 'rooms', 'reports']);
  return { ok: true, room: room.number, status };
}

/** The cleaning alarm: purple room + a ring on the housekeeping board and the desk. */
export function ringForCleaning({ room, taskId, reason = 'checkout' }) {
  const payload = {
    type: 'alert',
    kind: 'room.needs-clean',
    room: room?.number,
    room_id: room?.id,
    task_id: taskId,
    title: `Clean Room ${room?.number} · ክፍል ${room?.number} ያጽዱ`,
    am: 'ጽዳት ይፈልጋል',
    reason,
    at: Date.now(),
  };
  publishToRoles(['housekeeping'], payload);
  publishToRoles(['cashier', 'manager', 'admin'], { ...payload, title: `Room ${room?.number} needs cleaning — send housekeeping` });
  return payload;
}

/** Housekeeping can be pinged again if nobody moved (the alarm repeats). */
export function nudgeCleaning({ roomId, actor }) {
  const room = roomById(roomId);
  if (!room) return { error: 'Room not found.' };
  const task = db.prepare("SELECT * FROM housekeeping_tasks WHERE room_id = ? AND status != 'completed' ORDER BY created_at DESC").get(roomId);
  ringForCleaning({ room, taskId: task?.id, reason: 'nudge' });
  audit({ actor, action: 'cleaning-nudge', entity: 'room', entityId: roomId, detail: `Reminder sent for Room ${room.number}` });
  return { ok: true };
}

export function resolveMaintenance({ issueId, actor }) {
  const issue = db.prepare('SELECT * FROM maintenance_issues WHERE id = ?').get(issueId);
  if (!issue) return { error: 'Issue not found.' };
  db.prepare("UPDATE maintenance_issues SET status = 'resolved', resolved_at = ? WHERE id = ?").run(nowIso(), issueId);
  const room = roomById(issue.room_id);
  if (room && room.status === 'maintenance') db.prepare("UPDATE rooms SET status = 'available' WHERE id = ?").run(room.id);
  publish(['maintenance', 'rooms']);
  return { ok: true };
}

export function createMaintenance({ roomId, issue, category, priority, assignee, actor }) {
  const id_ = `MT-${120 + Math.floor(Math.random() * 800)}`;
  db.prepare(`INSERT INTO maintenance_issues (id, room_id, issue, category, assignee, priority, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`).run(id_, roomId || null, issue, category || 'General', assignee || 'Unassigned', priority || 'normal', nowIso());
  if (roomId && priority === 'high') db.prepare("UPDATE rooms SET status = 'maintenance', block_reason = ? WHERE id = ? AND status != 'occupied'").run(issue, roomId);
  publish(['maintenance', 'rooms']);
  return { id: id_ };
}

/* --------------------------- QR self registration -------------------------- */

export function approveCheckinRequest({ requestId, billingMode, rate, deposit, method, expectedOutAt, actor }) {
  const request = db.prepare('SELECT * FROM checkin_requests WHERE id = ?').get(requestId);
  if (!request) return { error: 'Request not found.' };
  if (request.status !== 'pending') return { error: 'This request was already handled.' };
  const payload = JSON.parse(request.payload || '{}');
  const result = checkInRoom({
    roomId: request.room_id, guest: payload, billingMode, rate, deposit, method, expectedOutAt, source: 'self', actor,
  });
  if (result.error) return result;
  db.prepare("UPDATE checkin_requests SET status = 'approved', handled_by = ?, handled_at = ?, stay_id = ? WHERE id = ?")
    .run(actor?.name || 'Cashier', nowIso(), result.stayId, requestId);
  publish(['checkinRequests', 'rooms']);
  return result;
}

export function rejectCheckinRequest({ requestId, reason, actor }) {
  db.prepare("UPDATE checkin_requests SET status = 'rejected', handled_by = ?, handled_at = ?, note = ? WHERE id = ?")
    .run(actor?.name || 'Cashier', nowIso(), reason || 'Rejected at the desk', requestId);
  publish(['checkinRequests']);
  return { ok: true };
}

export function createCheckinRequest({ roomId, payload, note, source = 'qr' }) {
  const rid = id('cr');
  db.prepare("INSERT INTO checkin_requests (id, room_id, payload, status, note, created_at) VALUES (?, ?, ?, 'pending', ?, ?)")
    .run(rid, roomId || null, JSON.stringify(payload || {}), note || `Self registration · ${source}`, nowIso());
  const room = roomId ? roomById(roomId) : null;
  publish(['checkinRequests']);
  publishToRoles(['cashier', 'admin', 'manager'], {
    type: 'alert', kind: 'checkin.request',
    title: `New guest registration${room ? ` · Room ${room.number}` : ''}`,
    payload, requestId: rid, at: Date.now(),
  });
  return { id: rid };
}
