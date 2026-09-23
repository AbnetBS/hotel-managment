/**
 * Shared billing rules.
 *
 * Used by the API server (authoritative) and by the browser app (live ticking
 * counters) so a cashier and the report always agree on the same number.
 */

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export const BILLING_MODES = {
  nightly: { key: 'nightly', label: 'Per night', am: 'በሌሊት', unit: 'night', unitPlural: 'nights' },
  dayuse: { key: 'dayuse', label: 'Day use (block of hours)', am: 'የቀን ኪራይ', unit: 'day-use block', unitPlural: 'day-use blocks' },
  hourly: { key: 'hourly', label: 'Per hour', am: 'በሰዓት', unit: 'hour', unitPlural: 'hours' },
};

/**
 * Work out what a stay costs for the time spent in the room right now.
 *
 * @param {object} stay  { billing_mode, rate, check_in_at, units_override, grace_hours }
 * @param {number} now   epoch ms
 */
export function computeRoomCharge(stay, now = Date.now()) {
  const mode = stay.billing_mode || 'nightly';
  const rate = Number(stay.rate || 0);
  const checkIn = new Date(stay.check_in_at || now).getTime();
  const endAt = stay.check_out_at ? new Date(stay.check_out_at).getTime() : now;
  const graceMs = (Number(stay.grace_hours ?? 1) || 0) * HOUR;
  const elapsed = Math.max(0, endAt - checkIn);

  let units;
  let unitMs;
  if (mode === 'hourly') unitMs = HOUR;
  else if (mode === 'dayuse') unitMs = Math.max(1, Number(stay.dayuse_hours || 3)) * HOUR;
  else unitMs = DAY;

  const billable = Math.max(0, elapsed - graceMs);
  units = Math.max(1, Math.ceil(billable / unitMs));

  // A cashier can override the billed units at checkout (late checkout, waiver, extra night).
  const override = stay.units_override;
  const billedUnits = override === null || override === undefined || override === '' ? units : Number(override);

  const amount = Math.round(billedUnits * rate);
  const msIntoUnit = billable % unitMs;
  const nextUnitInMs = Math.max(0, unitMs - msIntoUnit);

  return {
    mode,
    rate,
    units,
    billedUnits,
    unitMs,
    elapsedMs: elapsed,
    nextUnitInMs,
    nextUnitAt: now + nextUnitInMs,
    amount,
    autoAmount: Math.round(units * rate),
    overridden: billedUnits !== units,
    unitLabel: BILLING_MODES[mode].unit,
    unitLabelPlural: BILLING_MODES[mode].unitPlural,
  };
}

/** Total of every non-voided folio line of a given kind. */
export function sumKind(items, kinds) {
  const list = Array.isArray(kinds) ? kinds : [kinds];
  return items
    .filter((i) => !i.void && list.includes(i.kind))
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
}

/**
 * The live folio: room charge for time spent + everything posted + payments.
 */
export function folioTotals(stay, items = [], now = Date.now()) {
  const live = stay ? computeRoomCharge(stay, now) : null;
  const roomPosted = sumKind(items, 'room');
  const food = sumKind(items, 'food');
  const service = sumKind(items, 'service');
  const other = sumKind(items, 'other');
  const discount = Math.abs(sumKind(items, 'discount')) + Number(stay?.discount || 0);
  const paid = Math.abs(sumKind(items, 'payment'));

  const room = roomPosted > 0 ? roomPosted : live ? live.amount : 0;
  const charges = room + food + service + other;
  const total = charges - discount;

  return {
    live,
    room,
    roomPosted,
    food,
    service,
    other,
    discount,
    charges,
    total,
    paid,
    balance: Math.round(total - paid),
  };
}

/** 3h 12m / 2d 4h — used on the cashier countdown. */
export function formatElapsed(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatCountdown(ms) {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * The complete order flow for food & drink.
 * new → accepted → sent (to stations) → ready → delivering → delivered → completed
 */
export const ORDER_FLOW = ['new', 'accepted', 'sent', 'ready', 'delivering', 'delivered', 'completed'];

export const ORDER_STATUS = {
  new: { label: 'New order', am: 'አዲስ ትዕዛዝ', tone: 'coral' },
  accepted: { label: 'Accepted', am: 'ተቀብሏል', tone: 'amber' },
  sent: { label: 'In the station', am: 'ወደ ጣቢያ ተልኳል', tone: 'blue' },
  ready: { label: 'Ready · send waiter', am: 'ተዘጋጅቷል', tone: 'teal' },
  delivering: { label: 'On the way', am: 'በመንገድ ላይ', tone: 'purple' },
  delivered: { label: 'Delivered', am: 'ተደርሷል', tone: 'teal' },
  completed: { label: 'Completed', am: 'ተጠናቋል', tone: 'gray' },
  cancelled: { label: 'Cancelled', am: 'ተሰርዟል', tone: 'gray' },
};

export const STATIONS = {
  kitchen: { key: 'kitchen', label: 'Kitchen', am: 'ወጥ ቤት', icon: 'chef-hat' },
  barista: { key: 'barista', label: 'Barista · bar', am: 'ባሪስታ', icon: 'coffee' },
  juice: { key: 'juice', label: 'Juice station', am: 'ጁስ ጣቢያ', icon: 'cup' },
  bar: { key: 'bar', label: 'Bar', am: 'ባር', icon: 'glass' },
};

export const ROLES = {
  admin: { key: 'admin', label: 'Owner / Admin', am: 'ባለቤት / አድሚን', home: 'overview', blurb: 'Full control: rooms, prices, staff, menu and reports.' },
  manager: { key: 'manager', label: 'Manager', am: 'ማናጀር', home: 'overview', blurb: 'KPI dashboard, reports, housekeeping and maintenance.' },
  cashier: { key: 'cashier', label: 'Cashier / Front desk', am: 'ካሸር', home: 'rooms', blurb: 'Rooms, check-in, orders, bills and payments.' },
  waiter: { key: 'waiter', label: 'Waiter', am: 'ወይተር', home: 'deliveries', blurb: 'Deliver ready orders to rooms, confirm delivery.' },
  kitchen: { key: 'kitchen', label: 'Kitchen', am: 'ወጥ ቤት', home: 'station', blurb: 'Accept and finish food tickets.' },
  barista: { key: 'barista', label: 'Barista', am: 'ባሪስታ', home: 'station', blurb: 'Coffee and bar tickets.' },
  juice: { key: 'juice', label: 'Juice station', am: 'ጁስ ጣቢያ', home: 'station', blurb: 'Juice and soft drink tickets.' },
  housekeeping: { key: 'housekeeping', label: 'Housekeeping', am: 'ጽዳት ክፍል', home: 'housekeeping', blurb: 'Clean and release rooms after checkout.' },
  maintenance: { key: 'maintenance', label: 'Maintenance', am: 'ጥገና', home: 'maintenance', blurb: 'Fix reported room issues.' },
};

/** Which staff roles are allowed where. */
export const ROLE_NAV = {
  admin: ['overview', 'rooms', 'roomtypes', 'menu', 'qrcodes', 'orders', 'reservations', 'stays', 'folios', 'reports', 'staff', 'formbuilder', 'housekeeping', 'maintenance', 'settings', 'audit'],
  manager: ['overview', 'rooms', 'orders', 'reservations', 'stays', 'folios', 'reports', 'housekeeping', 'maintenance', 'audit'],
  cashier: ['rooms', 'orders', 'stays', 'folios', 'reservations'],
  waiter: ['deliveries'],
  kitchen: ['station'],
  barista: ['station'],
  juice: ['station'],
  housekeeping: ['housekeeping'],
  maintenance: ['maintenance'],
};

export function canSee(role, viewId) {
  const allowed = ROLE_NAV[role] || [];
  return allowed.includes(viewId);
}
