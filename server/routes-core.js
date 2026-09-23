/** Core API: sign-in, the cashier's room board, guest bills, orders and stations. */
import express from 'express';
import QRCode from 'qrcode';
import { db, allSettings, nowIso } from './db.js';
import { login, logout, requireAuth, requireRole, userForToken } from './auth.js';
import * as repo from './repo.js';
import * as actions from './actions.js';
import { operationsSnapshot, revenueSummary, dailyClose, trends, guestHistory } from './reports.js';
import { ROLES, STATIONS, computeRoomCharge, folioTotals } from '../shared/billing.js';
import { recordLoginFailure, clearLoginFailures } from './security.js';

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
  const result = login(username, pin, { ip: req.ip });
  if (result.error) {
    const left = recordLoginFailure(req);
    return res.status(401).json({
      error: result.error,
      attemptsLeft: left > 0 ? left : 0,
      hint: left <= 3 ? `${Math.max(0, left)} attempt(s) left before this username is paused.` : undefined,
    });
  }
  // A correct PIN proves it is staff, not a guesser — the counter starts again.
  clearLoginFailures(req);
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

/** Cleaned (cashier or housekeeper) — the room goes back to green. */
core.post('/rooms/:id/cleaned', requireAuth, requireRole('cashier', 'housekeeping', 'manager', 'admin'), (req, res) => {
  fail(res, actions.markRoomCleaned({ roomId: req.params.id, ...req.body, actor: req.user }));
});

/** Ring the housekeeping board again — nobody moved. */
core.post('/rooms/:id/nudge-cleaning', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  fail(res, actions.nudgeCleaning({ roomId: req.params.id, actor: req.user }));
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
  fail(res, actions.takePayment({ stayId: req.params.id, ...req.body, clientRef: req.body?.client_ref, actor: req.user }));
});

core.post('/stays/:id/charge', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const { kind = 'service', description, amount, station } = req.body || {};
  if (!description || !Number(amount)) return res.status(400).json({ error: 'Describe the charge and enter an amount.' });
  actions.postFolioItem({ stayId: req.params.id, kind, description, amount: Number(amount), station, actor: req.user });
  res.json({ stay: repo.stayView(req.params.id) });
});

core.post('/stays/:id/checkout', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const result = actions.checkOutStay({ stayId: req.params.id, ...req.body, clientRef: req.body?.client_ref, actor: req.user });
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
  const result = actions.createOrder({ ...req.body, clientRef: req.body?.client_ref, actor: req.user });
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

const STATION_ROLES = ['cashier', 'manager', 'admin', ...Object.keys(STATIONS)];

core.post('/order-items/:id/accept', requireAuth, requireRole(...STATION_ROLES), (req, res) => {
  fail(res, actions.acceptOrderItem({ itemId: req.params.id, actor: req.user }));
});

core.post('/order-items/:id/done', requireAuth, requireRole(...STATION_ROLES), (req, res) => {
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
  if (room_id && arrival && departure) {
    const clash = db.prepare(`SELECT * FROM reservations
                              WHERE room_id = ? AND status NOT IN ('cancelled', 'no-show', 'checked-out')
                                AND NOT (departure <= ? OR arrival >= ?)`)
      .get(room_id, arrival, departure);
    if (clash) {
      const alt = db.prepare(`SELECT r.number FROM rooms r
                              WHERE r.room_type_id = (SELECT room_type_id FROM rooms WHERE id = ?)
                                AND r.id != ?
                                AND COALESCE(r.status, 'available') NOT IN ('maintenance', 'out_of_order', 'occupied')
                                AND r.id NOT IN (SELECT room_id FROM reservations
                                                  WHERE room_id IS NOT NULL AND status NOT IN ('cancelled', 'no-show', 'checked-out')
                                                    AND NOT (departure <= ? OR arrival >= ?))
                              ORDER BY r.number LIMIT 3`).all(room_id, room_id, arrival, departure);
      return res.status(409).json({
        error: `That room is already booked for those dates (${clash.code} · ${clash.arrival} → ${clash.departure}).`,
        alternatives: alt.map((r) => r.number),
      });
    }
  }
  db.prepare(`INSERT INTO reservations (id, code, guest_name, phone, room_id, room_type_id, arrival, departure, nights, rate, source, status, deposit, note, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`).run(
    rid, code, guest_name, phone || null, room_id || null, room_type_id || null, arrival, departure, nights,
    Number(rate) || 0, source || 'Walk-in', Number(deposit) || 0, note || null, nowIso(), req.user.id,
  );
  if (room_id) db.prepare("UPDATE rooms SET status = 'reserved' WHERE id = ? AND status = 'available'").run(room_id);
  res.json({ id: rid, code, nights });
});

/** The only states a booking can be in, and how it may move. */
const RESERVATION_FLOW = {
  inquiry: ['tentative', 'confirmed', 'cancelled'],
  tentative: ['confirmed', 'cancelled', 'no-show'],
  confirmed: ['checked-in', 'cancelled', 'no-show'],
  'checked-in': ['checked-out'],
  'checked-out': [],
  cancelled: [],
  'no-show': [],
};

core.post('/reservations/:id/status', requireAuth, requireRole('cashier', 'manager', 'admin'), (req, res) => {
  const { status, reason } = req.body || {};
  const resa = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!resa) return res.status(404).json({ error: 'Reservation not found.' });
  if (!RESERVATION_FLOW[status]) return res.status(400).json({ error: 'Unknown booking status.' });
  if (!(RESERVATION_FLOW[resa.status] || []).includes(status)) {
    return res.status(409).json({ error: `A booking that is "${resa.status}" cannot become "${status}".` });
  }
  db.prepare('UPDATE reservations SET status = ?, note = COALESCE(?, note) WHERE id = ?')
    .run(status, reason ? `${status}: ${reason}` : null, req.params.id);
  if (['cancelled', 'no-show'].includes(status) && resa.room_id) {
    db.prepare("UPDATE rooms SET status = 'available' WHERE id = ? AND status = 'reserved'").run(resa.room_id);
  }
  if (status === 'confirmed' && resa.room_id) {
    db.prepare("UPDATE rooms SET status = 'reserved' WHERE id = ? AND status = 'available'").run(resa.room_id);
  }
  audit({ actor: req.user, action: 'reservation-status', entity: 'reservation', entityId: req.params.id, detail: `${resa.code} → ${status}${reason ? ` (${reason})` : ''}` });
  publish(['reservations', 'rooms']);
  res.json({ ok: true, status });
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

/**
 * The guest's own bill — everything on the folio: the room as it runs, food and
 * drinks, other services, discounts, what is already paid and what is left.
 * Shown on the phone, so it is grouped the way a guest reads it.
 */
function buildGuestBill(stay, items) {
  const clean = items.filter((i) => !i.void);
  const totals = folioTotals(stay, clean);
  const lines = clean.filter((i) => !['payment', 'room', 'discount'].includes(i.kind));
  const payments = clean.filter((i) => i.kind === 'payment');

  const group = (kind, title, titleAm) => {
    const list = lines.filter((i) => i.kind === kind);
    if (!list.length) return null;
    return {
      kind, title, title_am: titleAm,
      total: list.reduce((sum, i) => sum + i.amount, 0),
      lines: list.map((i) => ({ id: i.id, description: i.description, qty: i.qty, amount: i.amount, at: i.created_at })),
    };
  };

  const charge = computeRoomCharge(stay);
  return {
    stay: { code: stay.code, room: null, mode: stay.billing_mode, rate: stay.rate, check_in_at: stay.check_in_at },
    room: {
      title: 'Room', title_am: 'ክፍል',
      units: charge.billedUnits, unit_label: charge.billedUnits === 1 ? charge.unitLabel : charge.unitLabelPlural,
      live: !stay.check_out_at && stay.status === 'active',
      total: totals.room,
      line: `${charge.billedUnits} ${charge.billedUnits === 1 ? charge.unitLabel : charge.unitLabelPlural} × ${charge.rate}`,
    },
    groups: [
      group('food', 'Food & drinks', 'ምግብ እና መጠጥ'),
      group('service', 'Hotel services', 'የሆቴል አገልግሎቶች'),
      group('other', 'Other charges', 'ሌሎች ክፍያዎች'),
    ].filter(Boolean),
    payments: payments.map((i) => ({ id: i.id, description: i.description, amount: Math.abs(i.amount), at: i.created_at })),
    currency: allSettings().currency,
    service_charge_percent: Number(allSettings().service_charge_percent || 0),
    vat_percent: Number(allSettings().vat_percent || 0),
    subtotal: totals.charges,
    discount: Math.abs(totals.discount),
    service: totals.service,
    vat: totals.vat,
    total: totals.total,
    paid: totals.paid,
    balance: totals.balance,
    note: 'The desk settles the final bill when you check out. Food and services ordered in the room appear here immediately.',
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
    stayId: stay.id, roomId: room.id, channel: 'qr', note: req.body?.note, clientRef: req.body?.client_ref,
    items: (req.body?.items || []).map((i) => ({ menu_item_id: i.menu_item_id, qty: i.qty, note: i.note })),
  });
  if (result.error) return res.status(400).json(result);
  res.json({
    order: { code: result.order.code, total: result.order.total, items: result.order.items.length },
    duplicate: result.duplicate || undefined,
    message: 'Your order was sent to the reception desk.',
  });
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
