/** Reports and daily close — the numbers an owner actually asks for. */
import { db } from './db.js';
import { folioTotals } from '../shared/billing.js';

const dayOf = (value) => String(value || '').slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

function rangeOf({ from, to }) {
  return { from: from || todayStr(), to: to || from || todayStr() };
}

export function revenueSummary({ from, to } = {}) {
  const range = rangeOf({ from, to });
  const items = db.prepare('SELECT * FROM folio_items WHERE void = 0 AND bill_date BETWEEN ? AND ?').all(range.from, range.to);

  const sum = (kinds) => items.filter((i) => kinds.includes(i.kind)).reduce((s, i) => s + i.amount, 0);
  const rooms = sum(['room']);
  const food = sum(['food']);
  const service = sum(['service']);
  const other = sum(['other']);
  const discounts = Math.abs(sum(['discount']));
  const payments = Math.abs(sum(['payment']));

  const counterOrders = db.prepare(`SELECT * FROM orders WHERE channel = 'counter' AND charged = 1 AND status = 'completed'
                                     AND substr(closed_at, 1, 10) BETWEEN ? AND ?`).all(range.from, range.to);
  const counterSales = counterOrders.reduce((s, o) => s + o.total, 0);

  const methods = {};
  for (const i of items.filter((x) => x.kind === 'payment')) {
    const key = i.method || 'Other';
    methods[key] = (methods[key] || 0) + Math.abs(i.amount);
  }

  const byStation = {};
  for (const i of items.filter((x) => x.kind === 'food')) {
    const key = i.station || 'other';
    byStation[key] = (byStation[key] || 0) + i.amount;
  }

  return {
    range,
    rooms,
    food: food + counterSales,
    foodFromRooms: food,
    counterSales,
    service,
    other,
    discounts,
    gross: rooms + food + service + other + counterSales,
    net: rooms + food + service + other + counterSales - discounts,
    payments,
    methods,
    byStation,
    counterOrderCount: counterOrders.length,
  };
}

export function operationsSnapshot() {
  const today = todayStr();
  const rooms = db.prepare('SELECT * FROM rooms').all();
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const activeStays = db.prepare("SELECT * FROM stays WHERE status = 'active'").all();

  const arrivalsToday = db.prepare("SELECT COUNT(*) AS n FROM stays WHERE substr(check_in_at, 1, 10) = ?").get(today).n;
  const departuresToday = db.prepare("SELECT COUNT(*) AS n FROM stays WHERE substr(check_out_at, 1, 10) = ?").get(today).n;

  const balances = activeStays.map((stay) => {
    const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id);
    return folioTotals(stay, items).balance;
  });
  const outstanding = balances.reduce((s, b) => s + Math.max(0, b), 0);

  const closedStays = db.prepare("SELECT * FROM stays WHERE status = 'checked_out'").all();
  const unpaidClosed = closedStays
    .map((stay) => folioTotals(stay, db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id)).balance)
    .filter((b) => b > 0)
    .reduce((s, b) => s + b, 0);

  const ordersOpen = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('completed','cancelled')").get().n;
  const ordersNew = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'").get().n;
  const ordersReady = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'ready'").get().n;
  const ordersDelivering = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'delivering'").get().n;
  const maintenanceOpen = db.prepare("SELECT COUNT(*) AS n FROM maintenance_issues WHERE status != 'resolved'").get().n;
  const housekeepingOpen = db.prepare("SELECT COUNT(*) AS n FROM housekeeping_tasks WHERE status != 'completed'").get().n;
  const pendingRegistrations = db.prepare("SELECT COUNT(*) AS n FROM checkin_requests WHERE status = 'pending'").get().n;

  // Room money earned by guests who are still in house (their bill is not closed yet).
  const accruedRoomCharges = activeStays.reduce((sum, stay) => {
    const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(stay.id);
    return sum + folioTotals(stay, items).room;
  }, 0);

  const closedInRange = closedStays.filter((s) => s.check_out_at && dayOf(s.check_out_at) === today);
  const roomsSoldToday = closedInRange.length + occupied;
  const roomRevenueToday = revenueSummary({ from: today, to: today }).rooms;
  const adr = roomsSoldToday ? Math.round(roomRevenueToday / roomsSoldToday) : 0;

  return {
    today,
    rooms: rooms.length,
    occupied,
    available: rooms.filter((r) => r.status === 'available').length,
    cleaning: rooms.filter((r) => ['cleaning', 'dirty'].includes(r.status)).length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
    reserved: rooms.filter((r) => r.status === 'reserved').length,
    occupancy: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0,
    arrivalsToday,
    departuresToday,
    activeStays: activeStays.length,
    outstanding,
    unpaidClosed,
    ordersOpen,
    ordersNew,
    ordersReady,
    ordersDelivering,
    maintenanceOpen,
    housekeepingOpen,
    pendingRegistrations,
    adr,
    revpar: rooms.length ? Math.round(roomRevenueToday / rooms.length) : 0,
    accruedRoomCharges,
  };
}

export function dailyClose({ date } = {}) {
  const day = date || todayStr();
  const revenue = revenueSummary({ from: day, to: day });
  const folioItems = db.prepare('SELECT * FROM folio_items WHERE void = 0 AND bill_date = ? ORDER BY created_at').all(day);
  const stays = db.prepare(`SELECT * FROM stays WHERE substr(check_in_at,1,10) = ? OR substr(check_out_at,1,10) = ?`).all(day, day);
  const now = operationsSnapshot();
  const expectedCash = folioItems.filter((i) => i.kind === 'payment' && (i.method || 'Cash') === 'Cash').reduce((s, i) => s + Math.abs(i.amount), 0);
  return {
    date: day,
    revenue,
    payments: folioItems.filter((i) => i.kind === 'payment'),
    stays: stays.map((s) => ({ id: s.id, code: s.code, room_id: s.room_id, status: s.status, check_in_at: s.check_in_at, check_out_at: s.check_out_at })),
    expectedCash,
    occupancy: now.occupancy,
    outstanding: now.outstanding,
  };
}

export function trends({ days = 7 } = {}) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
    const r = revenueSummary({ from: date, to: date });
    const closed = db.prepare("SELECT COUNT(*) AS n FROM stays WHERE substr(check_out_at,1,10) = ?").get(date).n;
    out.push({ date, room: r.rooms, food: r.food, service: r.service, total: r.net, checkouts: closed });
  }
  return out;
}

export function guestHistory({ search } = {}) {
  const q = `%${String(search || '').trim().toLowerCase()}%`;
  const stays = db.prepare(`SELECT s.*, g.full_name, g.phone, r.number AS room_number
                            FROM stays s JOIN guests g ON g.id = s.guest_id LEFT JOIN rooms r ON r.id = s.room_id
                            ${search ? 'WHERE lower(g.full_name) LIKE ? OR g.phone LIKE ?' : ''}
                            ORDER BY s.check_in_at DESC LIMIT 60`).all(...(search ? [q, q] : []));
  return stays.map((s) => {
    const items = db.prepare('SELECT * FROM folio_items WHERE stay_id = ? AND void = 0').all(s.id);
    const totals = folioTotals(s, items);
    return {
      id: s.id, code: s.code, guest: s.full_name, phone: s.phone, room: s.room_number, status: s.status,
      check_in_at: s.check_in_at, check_out_at: s.check_out_at, nights: s.billing_mode !== 'nightly' ? null : undefined,
      billing_mode: s.billing_mode, total: totals.total, paid: totals.paid, balance: totals.balance,
    };
  });
}
