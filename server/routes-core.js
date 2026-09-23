/** Core API: sign-in, the cashier's room board, guest bills, orders and stations. */
import express from 'express';
import QRCode from 'qrcode';
import { db, allSettings, nowIso } from './db.js';
import { login, logout, requireAuth, requireRole, userForToken } from './auth.js';
import * as repo from './repo.js';
import * as actions from './actions.js';
import { operationsSnapshot, revenueSummary, dailyClose, trends, guestHistory } from './reports.js';
import { ROLES } from '../shared/billing.js';

export const core = express.Router();

const fail = (res, result, status = 400) => {
  if (result?.error) return res.status(status).json({ error: result.error });
  return res.json(result);
};

/* --------------------------------- auth ---------------------------------- */

core.get('/auth/roles', (req, res) => {
  res.json({ roles: Object.values(ROLES).map(({ key, label, am, blurb, home }) => ({ key, label, am, blurb, home })) });
});

core.post('/auth/login', (req, res) => {
  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Choose your role, then enter your username and PIN.' });
  const result = login(username, pin);
  if (result.error) return res.status(401).json({ error: result.error });
  res.json(result);
});

core.post('/auth/logout', (req, res) => {
  logout(req.get('x-clove-token'));
  res.json({ ok: true });
});

core.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, settings: allSettings(), snapshot: operationsSnapshot() });
});

/* ------------------------------ bootstrap -------------------------------- */

core.get('/bootstrap', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    settings: allSettings(),
    snapshot: operationsSnapshot(),
    rooms: repo.rooms(),
    roomTypes: repo.roomTypes(),
    menu: repo.menu(),
    activeStays: repo.stays({ status: 'active' }),
    openOrders: repo.orders({ statuses: ['new', 'accepted', 'sent', 'ready', 'delivering', 'delivered'] }),
    checkinRequests: repo.checkinRequests({ status: 'pending' }),
    housekeeping: repo.housekeeping(),
    maintenance: repo.maintenance(),
  });
});

/* -------------------------------- rooms ---------------------------------- */

core.get('/rooms', requireAuth, (req, res) => res.json({ rooms: repo.rooms() }));

core.get('/rooms/:id', requireAuth, (req, res) => {
  const room = repo.rooms().find((r) => r.id === req.params.id || r.number === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  res.json({ room, folio: room.stay ? repo.stayView(room.stay.id) : null, orders: room.stay ? repo.orders({ roomId: room.id, includeClosed: true, limit: 20 }) : [] });
});

core.post('/rooms/:id/checkin', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const result = actions.checkInRoom({ roomId: req.params.id, ...req.body, actor: req.user });
  if (result.error) return res.status(400).json(result);
  res.json({ ...result, folio: repo.stayView(result.stayId) });
});

core.post('/rooms/:id/status', requireAuth, requireRole('cashier', 'housekeeping', 'manager', 'admin'), (req, res) => {
  fail(res, actions.setRoomStatus({ roomId: req.params.id, ...req.body, actor: req.user }));
});

/* -------------------------------- stays ---------------------------------- */

core.get('/stays', requireAuth, (req, res) => {
  res.json({ stays: repo.stays({ status: req.query.status || 'active', limit: Number(req.query.limit) || 120 }) });
});

core.get('/stays/:id', requireAuth, (req, res) => {
  const stay = repo.stayView(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found.' });
  res.json({
    stay,
    orders: repo.orders({ roomId: stay.room_id, includeClosed: true, limit: 25 }),
    // Full order-timeline for this room, newest first (accept → send → ready → delivered).
    events: repo
      .orders({ roomId: stay.room_id, includeClosed: true, limit: 10 })
      .flatMap((order) => repo.orderEvents(order.id).map((event) => ({ ...event, order_code: order.code })))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 40),
  });
});

core.patch('/stays/:id', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found.' });
  const { expected_out_at, rate, note, adults } = req.body || {};
  db.prepare('UPDATE stays SET expected_out_at = COALESCE(?, expected_out_at), rate = COALESCE(?, rate), note = COALESCE(?, note), adults = COALESCE(?, adults), updated_at = ? WHERE id = ?')
    .run(expected_out_at || null, rate ?? null, note ?? null, adults ?? null, nowIso(), stay.id);
  res.json({ stay: repo.stayView(stay.id) });
});

core.post('/stays/:id/payment', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.takePayment({ stayId: req.params.id, ...req.body, actor: req.user }));
});

core.post('/stays/:id/charge', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const { kind = 'service', description, amount, station } = req.body || {};
  if (!description || !Number(amount)) return res.status(400).json({ error: 'Describe the charge and enter an amount.' });
  actions.postFolioItem({ stayId: req.params.id, kind, description, amount: Number(amount), station, actor: req.user });
  res.json({ stay: repo.stayView(req.params.id) });
});

core.post('/stays/:id/checkout', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const result = actions.checkOutStay({ stayId: req.params.id, ...req.body, actor: req.user });
  if (result.error) return res.status(400).json(result);
  res.json({ ...result, folio: repo.stayView(req.params.id) });
});

core.post('/stays/:id/move', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(req.params.id);
  if (!stay) return res.status(404).json({ error: 'Stay not found.' });
  const target = db.prepare('SELECT * FROM rooms WHERE id = ? OR number = ?').get(req.body?.room_id, req.body?.room_id);
  if (!target) return res.status(404).json({ error: 'Target room not found.' });
  if (actions.activeStayForRoom(target.id)) return res.status(400).json({ error: `Room ${target.number} is occupied.` });
  const from = stay.room_id;
  db.prepare('UPDATE stays SET room_id = ?, updated_at = ? WHERE id = ?').run(target.id, nowIso(), stay.id);
  db.prepare("UPDATE rooms SET status = 'dirty' WHERE id = ?").run(from);
  db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(target.id);
  res.json({ stay: repo.stayView(stay.id) });
});

/* -------------------------------- orders --------------------------------- */

core.get('/orders', requireAuth, (req, res) => {
  const statuses = req.query.status ? String(req.query.status).split(',') : undefined;
  res.json({
    orders: repo.orders({
      statuses,
      station: req.query.station || undefined,
      roomId: req.query.room_id || undefined,
      includeClosed: req.query.closed === '1',
      limit: Number(req.query.limit) || 80,
    }),
  });
});

core.get('/orders/:id', requireAuth, (req, res) => {
  const order = repo.orderView(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order, events: repo.orderEvents(order.id) });
});

core.post('/orders', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const result = actions.createOrder({ ...req.body, actor: req.user });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

core.post('/orders/:id/accept', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.acceptOrder({ orderId: req.params.id, callConfirmed: !!req.body?.call_confirmed, actor: req.user }));
});

core.post('/orders/:id/confirm-call', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.confirmCall({ orderId: req.params.id, actor: req.user }));
});

core.post('/orders/:id/send', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.sendOrderToStations({ orderId: req.params.id, actor: req.user }));
});

core.post('/orders/:id/send-waiter', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.sendWaiter({ orderId: req.params.id, actor: req.user }));
});

core.post('/orders/:id/deliver', requireAuth, requireRole('waiter', 'cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.deliverOrder({ orderId: req.params.id, actor: req.user }));
});

core.post('/orders/:id/charge', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.chargeOrderToFolio({ orderId: req.params.id, actor: req.user }));
});

core.post('/orders/:id/close', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.closeOrder({ orderId: req.params.id, paidMethod: req.body?.paid_method, actor: req.user }));
});

core.post('/orders/:id/cancel', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.cancelOrder({ orderId: req.params.id, reason: req.body?.reason, actor: req.user }));
});

core.post('/order-items/:id/accept', requireAuth, requireRole('kitchen', 'barista', 'juice', 'bar', 'cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.acceptOrderItem({ itemId: req.params.id, actor: req.user }));
});

core.post('/order-items/:id/done', requireAuth, requireRole('kitchen', 'barista', 'juice', 'bar', 'cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.completeOrderItem({ itemId: req.params.id, actor: req.user }));
});

/* --------------------------- registrations / tasks ------------------------ */

core.get('/checkin-requests', requireAuth, (req, res) => {
  res.json({ requests: repo.checkinRequests({ status: req.query.status || 'pending' }) });
});

core.post('/checkin-requests/:id/approve', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const result = actions.approveCheckinRequest({ requestId: req.params.id, ...req.body, actor: req.user });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

core.post('/checkin-requests/:id/reject', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.rejectCheckinRequest({ requestId: req.params.id, reason: req.body?.reason, actor: req.user }));
});

core.get('/housekeeping', requireAuth, (req, res) => res.json({ tasks: repo.housekeeping({ status: req.query.status }) }));

core.post('/housekeeping/:id/advance', requireAuth, requireRole('housekeeping', 'cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.advanceHousekeeping({ taskId: req.params.id, actor: req.user }));
});

core.get('/maintenance', requireAuth, (req, res) => res.json({ issues: repo.maintenance() }));

core.post('/maintenance', requireAuth, (req, res) => {
  const { room_id, issue, category, priority, assignee } = req.body || {};
  if (!issue) return res.status(400).json({ error: 'Describe the problem.' });
  res.json(actions.createMaintenance({ roomId: room_id, issue, category, priority, assignee, actor: req.user }));
});

core.post('/maintenance/:id/resolve', requireAuth, (req, res) => {
  fail(res, actions.resolveMaintenance({ issueId: req.params.id, actor: req.user }));
});

core.get('/reservations', requireAuth, (req, res) => res.json({ reservations: repo.reservations() }));

core.post('/reservations', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const { guest_name, phone, room_id, room_type_id, arrival, departure, rate, source, deposit, note } = req.body || {};
  if (!guest_name || !arrival || !departure) return res.status(400).json({ error: 'Guest name, arrival and departure are required.' });
  const nights = Math.max(1, Math.round((new Date(departure) - new Date(arrival)) / 86400000));
  const rid = `res-${Math.random().toString(36).slice(2, 8)}`;
  const code = `RES-${2400 + db.prepare('SELECT COUNT(*) AS n FROM reservations').get().n + 1}`;
  db.prepare(`INSERT INTO reservations (id, code, guest_name, phone, room_id, room_type_id, arrival, departure, nights, rate, source, status, deposit, note, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`).run(
    rid, code, guest_name, phone || null, room_id || null, room_type_id || null, arrival, departure, nights,
    Number(rate) || 0, source || 'Walk-in', Number(deposit) || 0, note || null, nowIso(), req.user.id,
  );
  if (room_id) db.prepare("UPDATE rooms SET status = 'reserved' WHERE id = ? AND status = 'available'").run(room_id);
  res.json({ id: rid, code, nights });
});

core.post('/reservations/:id/status', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const { status } = req.body || {};
  const resa = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!resa) return res.status(404).json({ error: 'Reservation not found.' });
  db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, req.params.id);
  if (status === 'cancelled' && resa.room_id) db.prepare("UPDATE rooms SET status = 'available' WHERE id = ? AND status = 'reserved'").run(resa.room_id);
  res.json({ ok: true });
});

/* -------------------------------- reports -------------------------------- */

core.get('/reports/summary', requireAuth, requireRole('manager', 'admin'), (req, res) => {
  const { from, to } = req.query;
  res.json({
    revenue: revenueSummary({ from, to }),
    snapshot: operationsSnapshot(),
    trends: trends({ days: Number(req.query.days) || 7 }),
  });
});

core.get('/reports/daily', requireAuth, requireRole('manager', 'admin'), (req, res) => {
  res.json(dailyClose({ date: req.query.date }));
});

core.get('/reports/guests', requireAuth, requireRole('manager', 'admin', 'cashier'), (req, res) => {
  res.json({ guests: guestHistory({ search: req.query.search }) });
});

/* ------------------------------ QR codes --------------------------------- */

core.get('/qr/:roomId.png', requireAuth, async (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? OR number = ?').get(req.params.roomId, req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  const target = req.query.target === 'register' ? 'r' : 'q';
  const base = String(req.query.base || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const url = `${base}/${target}/${room.qr_token}`;
  const png = await QRCode.toBuffer(url, { width: 512, margin: 1, color: { dark: '#163536', light: '#ffffff' } });
  res.type('png').send(png);
});

/* ------------------------- guest (no login) pages ----------------------- */

function roomByToken(token) {
  return db.prepare('SELECT * FROM rooms WHERE qr_token = ?').get(token);
}

function guestRoomPayload(room) {
  const type = repo.roomTypeById(room.room_type_id);
  const stay = actions.activeStayForRoom(room.id);
  const guest = stay ? db.prepare('SELECT * FROM guests WHERE id = ?').get(stay.guest_id) : null;
  const items = stay ? db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id) : [];
  const settings = allSettings();
  return {
    hotel: {
      name: settings.hotel_name, line: settings.property_line, phone: settings.phone,
      wifi_name: settings.wifi_name, wifi_password: settings.wifi_password,
      checkout_hour: settings.checkout_hour, currency: settings.currency,
    },
    room: {
      id: room.id, number: room.number, floor: room.floor, status: room.status,
      type: type?.name, description: type?.description, amenities: type?.amenities || [], photos: type?.photos || [],
      beds: type?.beds, max_guests: type?.max_guests,
      nightly_rate: type?.nightly_rate, hourly_rate: type?.hourly_rate, dayuse_rate: type?.dayuse_rate, dayuse_hours: type?.dayuse_hours,
    },
    stay: stay
      ? {
          id: stay.id, code: stay.code, guest_name: guest?.full_name, billing_mode: stay.billing_mode, rate: stay.rate,
          check_in_at: stay.check_in_at, expected_out_at: stay.expected_out_at, source: stay.source,
          totals: null,
        }
      : null,
    bill: stay ? buildGuestBill(stay, items) : null,
    canOrder: !!stay,
    fields: repo.registrationFields(),
  };
}

function buildGuestBill(stay, items) {
  const visible = items.filter((i) => ['food', 'service', 'other'].includes(i.kind));
  const serviceChargePercent = Number(allSettings().service_charge_percent || 0);
  const vatPercent = Number(allSettings().vat_percent || 0);
  const charges = visible.reduce((s, i) => s + i.amount, 0);
  const service = Math.round((charges * serviceChargePercent) / 100);
  const vat = Math.round(((charges + service) * vatPercent) / 100);
  return {
    lines: visible.map((i) => ({ id: i.id, description: i.description, amount: i.amount, at: i.created_at, kind: i.kind })),
    charges, service, vat, total: charges + service + vat,
    note: 'Room charges are settled at the reception desk when you check out.',
  };
}

core.get('/public/hotel', (req, res) => {
  const settings = allSettings();
  res.json({ hotel: { name: settings.hotel_name, line: settings.property_line, phone: settings.phone, currency: settings.currency } });
});

core.get('/public/room/:token', (req, res) => {
  const room = roomByToken(req.params.token);
  if (!room) return res.status(404).json({ error: 'This QR code is not linked to a room any more.' });
  res.json(guestRoomPayload(room));
});

core.get('/public/menu/:token', (req, res) => {
  const room = roomByToken(req.params.token);
  if (!room) return res.status(404).json({ error: 'This QR code is not linked to a room any more.' });
  const menu = repo.menu();
  res.json({
    ...guestRoomPayload(room),
    categories: menu.categories.filter((c) => c.active),
    items: menu.items.filter((i) => i.available),
  });
});

core.post('/public/order/:token', (req, res) => {
  const room = roomByToken(req.params.token);
  if (!room) return res.status(404).json({ error: 'This QR code is not linked to a room any more.' });
  const stay = actions.activeStayForRoom(room.id);
  if (!stay) return res.status(400).json({ error: 'This room is not checked in yet. Please order at the reception desk.' });
  const result = actions.createOrder({
    stayId: stay.id, roomId: room.id, channel: 'qr', note: req.body?.note,
    items: (req.body?.items || []).map((i) => ({ menu_item_id: i.menu_item_id, qty: i.qty, note: i.note })),
  });
  if (result.error) return res.status(400).json(result);
  res.json({ order: { code: result.order.code, total: result.order.total, items: result.order.items.length }, message: 'Your order was sent to the reception desk.' });
});

core.post('/public/register/:token', (req, res) => {
  const room = roomByToken(req.params.token);
  if (!room) return res.status(404).json({ error: 'This QR code is not linked to a room any more.' });
  if (actions.activeStayForRoom(room.id)) return res.status(400).json({ error: 'This room is already occupied. Please speak to the reception desk.' });
  const result = actions.createCheckinRequest({ roomId: room.id, payload: req.body?.fields || {}, source: 'qr' });
  res.json({ ...result, message: 'Thank you! Your details were sent to the reception desk for confirmation.' });
});

core.get('/public/bill/:token', (req, res) => {
  const room = roomByToken(req.params.token);
  if (!room) return res.status(404).json({ error: 'Unknown room.' });
  const stay = actions.activeStayForRoom(room.id);
  if (!stay) return res.json({ bill: null });
  res.json({ bill: buildGuestBill(stay, db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id)) });
});
