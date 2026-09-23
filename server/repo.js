/** Read models: everything the screens display, assembled in one place. */
import { db, allSettings, parseJson, nowIso } from './db.js';
import { folioTotals, computeRoomCharge, ORDER_STATUS } from '../shared/billing.js';

export const ROOM_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'dirty', 'maintenance'];

export function settings() {
  return allSettings();
}

export function roomTypeView(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    billing_mode: row.billing_mode,
    nightly_rate: row.nightly_rate,
    hourly_rate: row.hourly_rate,
    dayuse_rate: row.dayuse_rate,
    dayuse_hours: row.dayuse_hours,
    max_guests: row.max_guests,
    beds: row.beds,
    amenities: parseJson(row.amenities, []),
    photos: parseJson(row.photos, []),
    active: !!row.active,
    sort: row.sort,
  };
}

export function roomTypes() {
  return db.prepare('SELECT * FROM room_types ORDER BY sort, name').all().map(roomTypeView);
}

export function roomTypeById(id) {
  return roomTypeView(db.prepare('SELECT * FROM room_types WHERE id = ?').get(id));
}

/** Rooms with their type, guest and live bill — the cashier's green/red grid. */
export function rooms() {
  const roomRows = db.prepare('SELECT * FROM rooms ORDER BY floor, number').all();
  const typeRows = db.prepare('SELECT * FROM room_types').all().map(roomTypeView);
  const types = new Map(typeRows.map((t) => [t.id, t]));
  const activeStays = db.prepare("SELECT * FROM stays WHERE status = 'active'").all();
  const guestRows = db.prepare('SELECT * FROM guests').all();
  const guests = new Map(guestRows.map((g) => [g.id, g]));

  return roomRows.map((room) => {
    const type = types.get(room.room_type_id) || null;
    const stay = activeStays.find((s) => s.room_id === room.id) || null;
    const guest = stay ? guests.get(stay.guest_id) : null;
    const items = stay ? db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id) : [];
    const totals = stay ? folioTotals(stay, items) : null;
    return {
      id: room.id,
      number: room.number,
      floor: room.floor,
      status: room.status,
      billing_mode: room.billing_mode || type?.billing_mode || 'nightly',
      block_reason: room.block_reason,
      note: room.note,
      qr_token: room.qr_token,
      type,
      stay: stay
        ? {
            id: stay.id,
            code: stay.code,
            guest: guest?.full_name || 'In-house guest',
            phone: guest?.phone || '',
            check_in_at: stay.check_in_at,
            expected_out_at: stay.expected_out_at,
            billing_mode: stay.billing_mode,
            rate: stay.rate,
            source: stay.source,
            adults: stay.adults,
          }
        : null,
      totals,
    };
  });
}

export function guestView(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    nationality: row.nationality,
    id_type: row.id_type,
    id_number: row.id_number,
    extra: parseJson(row.extra, {}),
    created_at: row.created_at,
    source: row.source,
  };
}

export function stayView(stayId) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) return null;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(stay.room_id);
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(stay.guest_id);
  const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? ORDER BY created_at').all(stayId);
  const orders = db.prepare('SELECT * FROM orders WHERE stay_id = ? ORDER BY created_at DESC').all(stayId);
  const clean = items.filter((i) => !i.void);
  return {
    id: stay.id,
    code: stay.code,
    status: stay.status,
    room_id: stay.room_id,
    room_number: room?.number || '—',
    room_type: roomTypeById(room?.room_type_id),
    guest: guestView(guest),
    billing_mode: stay.billing_mode,
    rate: stay.rate,
    // The money the guest agreed to pay in, frozen at check-in.
    currency: stay.currency || 'ETB',
    fx_rate: stay.fx_rate || (stay.currency && stay.currency !== 'ETB' ? null : 1),
    branch_id: stay.branch_id || null,
    dayuse_hours: stay.dayuse_hours,
    grace_hours: stay.grace_hours,
    units_override: stay.units_override,
    check_in_at: stay.check_in_at,
    expected_out_at: stay.expected_out_at,
    check_out_at: stay.check_out_at,
    discount: stay.discount,
    adults: stay.adults,
    children: stay.children,
    source: stay.source,
    note: stay.note,
    created_at: stay.created_at,
    items: clean.map((i) => ({
      id: i.id, kind: i.kind, description: i.description, qty: i.qty, amount: i.amount, station: i.station,
      method: i.method, order_id: i.order_id, created_at: i.created_at, bill_date: i.bill_date, created_by: i.created_by,
    })),
    voidItems: items.filter((i) => i.void).map((i) => ({ id: i.id, description: i.description, amount: i.amount })),
    orderCodes: orders.map((o) => o.code),
    totals: folioTotals(stay, clean),
    live: computeRoomCharge(stay),
  };
}

export function stays({ status = 'active', limit = 200 } = {}) {
  const rows = status === 'all'
    ? db.prepare('SELECT id FROM stays ORDER BY created_at DESC LIMIT ?').all(limit)
    : db.prepare('SELECT id FROM stays WHERE status = ? ORDER BY check_in_at DESC LIMIT ?').all(status, limit);
  return rows.map((r) => stayView(r.id));
}

export function activeStaysByRoom(roomIds) {
  if (!roomIds?.length) return [];
  const placeholders = roomIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM stays WHERE status = 'active' AND room_id IN (${placeholders})`).all(...roomIds);
}

export function menu() {
  const categories = db.prepare('SELECT * FROM menu_categories ORDER BY sort, name').all()
    .map((c) => ({ id: c.id, name: c.name, name_am: c.name_am, station: c.station, sort: c.sort, active: !!c.active }));
  const items = db.prepare('SELECT * FROM menu_items ORDER BY sort, name').all().map((i) => ({
    id: i.id, name: i.name, name_am: i.name_am, description: i.description, price: i.price,
    category_id: i.category_id, station: i.station, prep_minutes: i.prep_minutes, available: !!i.available, emoji: i.emoji, sort: i.sort,
  }));
  return { categories, items };
}

export function orderItems(orderId) {
  return db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId).map((i) => ({
    id: i.id, name: i.name, name_am: i.name_am, qty: i.qty, unit_price: i.unit_price, station: i.station,
    status: i.status, note: i.note, accepted_at: i.accepted_at, done_at: i.done_at, amount: Math.round(i.qty * i.unit_price),
  }));
}

export function orderView(rowOrId) {
  const row = typeof rowOrId === 'string' ? db.prepare('SELECT * FROM orders WHERE id = ?').get(rowOrId) : rowOrId;
  if (!row) return null;
  const room = row.room_id ? db.prepare('SELECT * FROM rooms WHERE id = ?').get(row.room_id) : null;
  const items = orderItems(row.id);
  const stations = [...new Set(items.map((i) => i.station))];
  const allDone = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'served');
  return {
    id: row.id, code: row.code, channel: row.channel, status: row.status, note: row.note, total: row.total,
    call_confirmed: !!row.call_confirmed, charged: !!row.charged, cancel_reason: row.cancel_reason,
    room_id: row.room_id, room_number: room?.number || '—', stay_id: row.stay_id, guest_name: row.guest_name,
    created_at: row.created_at, accepted_at: row.accepted_at, sent_at: row.sent_at, ready_at: row.ready_at,
    delivering_at: row.delivering_at, delivered_at: row.delivered_at, closed_at: row.closed_at,
    created_by: row.created_by, accepted_by: row.accepted_by, delivered_by: row.delivered_by,
    items, stations, allDone,
    statusLabel: ORDER_STATUS[row.status]?.label || row.status,
    ageMs: Date.now() - new Date(row.created_at).getTime(),
  };
}

export function orders({ statuses, station, roomId, limit = 80, includeClosed = false } = {}) {
  const where = [];
  const params = [];
  if (statuses?.length) {
    where.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  } else if (!includeClosed) {
    where.push("status NOT IN ('completed','cancelled')");
  }
  if (roomId) {
    where.push('room_id = ?');
    params.push(roomId);
  }
  const rows = db.prepare(`SELECT * FROM orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ?`).all(...params, limit);
  let list = rows.map(orderView);
  if (station) list = list.filter((o) => o.items.some((i) => i.station === station && i.status !== 'done' && i.status !== 'served'));
  return list;
}

export function orderEvents(orderId) {
  return db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY at').all(orderId).map((e) => ({
    id: e.id, at: e.at, actor: e.actor, type: e.type, detail: e.detail,
  }));
}

export function checkinRequests({ status = 'pending' } = {}) {
  const rows = status === 'all'
    ? db.prepare('SELECT * FROM checkin_requests ORDER BY created_at DESC LIMIT 60').all()
    : db.prepare('SELECT * FROM checkin_requests WHERE status = ? ORDER BY created_at DESC LIMIT 60').all(status);
  return rows.map((r) => {
    const room = r.room_id ? db.prepare('SELECT * FROM rooms WHERE id = ?').get(r.room_id) : null;
    return {
      id: r.id, status: r.status, note: r.note, created_at: r.created_at, handled_by: r.handled_by, handled_at: r.handled_at, stay_id: r.stay_id,
      room_id: r.room_id, room_number: room?.number || '—', payload: parseJson(r.payload, {}),
    };
  });
}

export function housekeeping({ status } = {}) {
  const rows = status
    ? db.prepare('SELECT * FROM housekeeping_tasks WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM housekeeping_tasks ORDER BY created_at DESC').all();
  return rows.map((t) => {
    const room = db.prepare('SELECT number FROM rooms WHERE id = ?').get(t.room_id);
    return { id: t.id, room_id: t.room_id, room_number: room?.number || '—', type: t.type, assignee: t.assignee, priority: t.priority, status: t.status, note: t.note, created_at: t.created_at, completed_at: t.completed_at };
  });
}

export function maintenance() {
  return db.prepare('SELECT * FROM maintenance_issues ORDER BY created_at DESC').all().map((m) => {
    const room = db.prepare('SELECT number FROM rooms WHERE id = ?').get(m.room_id);
    return {
      id: m.id, room_id: m.room_id, room_number: room?.number || '—', issue: m.issue, category: m.category,
      assignee: m.assignee, priority: m.priority, status: m.status,
      cost: m.cost ?? null, verified_by: m.verified_by || null,
      started_at: m.started_at || null, fixed_at: m.fixed_at || null,
      created_at: m.created_at, resolved_at: m.resolved_at,
    };
  });
}

export function reservations() {
  return db.prepare('SELECT * FROM reservations ORDER BY arrival').all().map((r) => {
    const room = r.room_id ? db.prepare('SELECT * FROM rooms WHERE id = ?').get(r.room_id) : null;
    return {
      id: r.id, code: r.code, guest_name: r.guest_name, phone: r.phone, room_id: r.room_id, room_number: room?.number || '—',
      room_type_id: r.room_type_id, room_type: roomTypeById(r.room_type_id)?.name || '—', arrival: r.arrival, departure: r.departure,
      nights: r.nights, rate: r.rate, source: r.source, status: r.status, deposit: r.deposit, note: r.note,
    };
  });
}

export function users() {
  return db.prepare('SELECT * FROM users ORDER BY role, name').all().map((u) => ({
    id: u.id, name: u.name, username: u.username, role: u.role, phone: u.phone, active: !!u.active, created_at: u.created_at, last_login_at: u.last_login_at,
  }));
}

export function registrationFields({ onlyActive = true } = {}) {
  const rows = onlyActive
    ? db.prepare('SELECT * FROM registration_fields WHERE active = 1 ORDER BY sort').all()
    : db.prepare('SELECT * FROM registration_fields ORDER BY sort').all();
  return rows.map((f) => {
    const meta = parseJson(f.options, null);
    return {
      id: f.id, key: f.key, label: f.label, label_am: f.label_am, type: f.type, required: !!f.required,
      options: Array.isArray(meta) ? meta : meta?.options || null,
      default: Array.isArray(meta) ? null : meta?.default || null,
      placeholder: f.placeholder, sort: f.sort, active: !!f.active,
    };
  });
}

export function auditLog({ limit = 120 } = {}) {
  return db.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT ?').all(limit);
}

export function nextOrderCode() {
  const row = db.prepare("SELECT MAX(CAST(code AS INTEGER)) AS max FROM orders WHERE code GLOB '[0-9]*'").get();
  const base = row?.max && row.max > 1000 ? row.max : 1041;
  return String(base + 1);
}

export function logEvent(orderId, actor, type, detail) {
  db.prepare('INSERT INTO order_events (id, order_id, at, actor, type, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(`ev-${Math.random().toString(36).slice(2, 10)}`, orderId, nowIso(), actor || 'system', type, detail || null);
}
