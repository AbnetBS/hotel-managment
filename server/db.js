/**
 * SQLite storage for Clove House.
 * One file, no external service — easy to back up (copy server/data/clove.db).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, 'data');
export const UPLOAD_DIR = path.join(here, 'uploads');
// Guest identity scans are sensitive: they live OUTSIDE the public /uploads
// folder and are only ever streamed back through an authenticated API route.
export const ID_DIR = path.join(here, 'id-docs');
export const DB_PATH = process.env.CLOVE_DB || path.join(DATA_DIR, 'clove.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ID_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS room_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  billing_mode TEXT NOT NULL DEFAULT 'nightly',
  nightly_rate REAL NOT NULL DEFAULT 0,
  hourly_rate REAL NOT NULL DEFAULT 0,
  dayuse_rate REAL NOT NULL DEFAULT 0,
  dayuse_hours REAL NOT NULL DEFAULT 3,
  max_guests INTEGER NOT NULL DEFAULT 2,
  beds TEXT,
  amenities TEXT,
  photos TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  room_type_id TEXT REFERENCES room_types(id),
  status TEXT NOT NULL DEFAULT 'available',
  billing_mode TEXT,
  block_reason TEXT,
  note TEXT,
  qr_token TEXT UNIQUE,
  cleaned_at TEXT,
  cleaned_by TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS registration_fields (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  label_am TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  required INTEGER NOT NULL DEFAULT 0,
  options TEXT,
  placeholder TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nationality TEXT,
  id_type TEXT,
  id_number TEXT,
  extra TEXT,
  created_at TEXT,
  created_by TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS stays (
  id TEXT PRIMARY KEY,
  code TEXT,
  guest_id TEXT REFERENCES guests(id),
  room_id TEXT REFERENCES rooms(id),
  billing_mode TEXT NOT NULL DEFAULT 'nightly',
  rate REAL NOT NULL DEFAULT 0,
  dayuse_hours REAL DEFAULT 3,
  grace_hours REAL DEFAULT 1,
  units_override REAL,
  check_in_at TEXT,
  expected_out_at TEXT,
  check_out_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  discount REAL DEFAULT 0,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  source TEXT DEFAULT 'cashier',
  note TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS folio_items (
  id TEXT PRIMARY KEY,
  stay_id TEXT REFERENCES stays(id),
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  station TEXT,
  order_id TEXT,
  method TEXT,
  reference TEXT,
  bill_date TEXT,
  void INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_am TEXT,
  station TEXT NOT NULL DEFAULT 'kitchen',
  sort INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_am TEXT,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  category_id TEXT REFERENCES menu_categories(id),
  station TEXT NOT NULL DEFAULT 'kitchen',
  prep_minutes INTEGER DEFAULT 15,
  available INTEGER NOT NULL DEFAULT 1,
  emoji TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT,
  room_id TEXT,
  stay_id TEXT,
  guest_name TEXT,
  channel TEXT NOT NULL DEFAULT 'qr',
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  total REAL DEFAULT 0,
  call_confirmed INTEGER DEFAULT 0,
  charged INTEGER DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT,
  accepted_at TEXT,
  sent_at TEXT,
  ready_at TEXT,
  delivering_at TEXT,
  delivered_at TEXT,
  closed_at TEXT,
  created_by TEXT,
  accepted_by TEXT,
  delivered_by TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  menu_item_id TEXT,
  name TEXT,
  name_am TEXT,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  station TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  accepted_at TEXT,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  at TEXT,
  actor TEXT,
  type TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS checkin_requests (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT,
  handled_by TEXT,
  handled_at TEXT,
  stay_id TEXT
);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  type TEXT,
  assignee TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  note TEXT,
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_issues (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  issue TEXT,
  category TEXT,
  assignee TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  created_at TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  code TEXT,
  guest_name TEXT,
  phone TEXT,
  room_id TEXT,
  room_type_id TEXT,
  arrival TEXT,
  departure TEXT,
  nights INTEGER,
  rate REAL,
  source TEXT,
  status TEXT DEFAULT 'confirmed',
  deposit REAL DEFAULT 0,
  note TEXT,
  created_at TEXT,
  created_by TEXT
);

/* ------------------------- guest requests (QR) --------------------------- */
CREATE TABLE IF NOT EXISTS guest_requests (
  id TEXT PRIMARY KEY,
  stay_id TEXT,
  room_id TEXT,
  room_number TEXT,
  guest_name TEXT,
  kind TEXT NOT NULL,
  department TEXT,
  note TEXT,
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  handled_by TEXT,
  handled_at TEXT,
  created_at TEXT
);

/* ------------------------------ lost & found ----------------------------- */
CREATE TABLE IF NOT EXISTS lost_found (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  description TEXT,
  found_at TEXT,
  location TEXT,
  room_id TEXT,
  found_by TEXT,
  guest_name TEXT,
  storage TEXT,
  status TEXT DEFAULT 'stored',
  returned_to TEXT,
  returned_at TEXT,
  created_at TEXT
);

/* ------------------------- inventory and recipes ------------------------- */
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_am TEXT,
  unit TEXT DEFAULT 'pcs',
  stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  supplier TEXT,
  active INTEGER DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  qty REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL,
  qty REAL DEFAULT 0,
  kind TEXT DEFAULT 'usage',
  reference TEXT,
  note TEXT,
  actor TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT,
  name TEXT,
  qty REAL DEFAULT 0,
  unit TEXT,
  status TEXT DEFAULT 'open',
  note TEXT,
  created_at TEXT,
  created_by TEXT,
  handled_at TEXT
);

/* --------------------- branches (hotel group growth) --------------------- */
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  phone TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT
);

/* ------------------- approvals for sensitive actions --------------------- */
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  detail TEXT,
  amount REAL,
  reason TEXT,
  approved_by TEXT NOT NULL,
  requested_by TEXT,
  created_at TEXT,
  expires_at TEXT
);

/* ------------------------------ extra services --------------------------- */
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_am TEXT,
  kind TEXT DEFAULT 'service',
  price REAL DEFAULT 0,
  station TEXT,
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT,
  actor_id TEXT,
  actor_name TEXT,
  role TEXT,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_folio_stay ON folio_items(stay_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stays_status ON stays(status);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
`);

/* ---------- tiny migrations (old databases keep working) ---------- */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('rooms', 'cleaned_at', 'TEXT');
ensureColumn('rooms', 'cleaned_by', 'TEXT');
ensureColumn('housekeeping_tasks', 'started_at', 'TEXT');
// Duplicate protection: a payment or an order carries the id the device made up,
// so a retry after a dropped connection can never land twice.
ensureColumn('folio_items', 'client_ref', 'TEXT');
// currency on the folio: a bill can be quoted in the guest's own money
ensureColumn('stays', 'currency', 'TEXT');
ensureColumn('stays', 'fx_rate', 'REAL');
ensureColumn('folio_items', 'currency', 'TEXT');
ensureColumn('folio_items', 'fx_rate', 'REAL');
ensureColumn('folio_items', 'foreign_amount', 'REAL');
// maintenance gets a full lifecycle
ensureColumn('maintenance_issues', 'assigned_to', 'TEXT');
ensureColumn('maintenance_issues', 'started_at', 'TEXT');
ensureColumn('maintenance_issues', 'fixed_at', 'TEXT');
ensureColumn('maintenance_issues', 'verified_by', 'TEXT');
ensureColumn('maintenance_issues', 'cost', 'REAL');
// identity documents (kept minimal, access-controlled)
ensureColumn('guests', 'id_document_url', 'TEXT');
ensureColumn('guests', 'id_document_at', 'TEXT');
ensureColumn('guests', 'id_document_by', 'TEXT');
// The private filename on disk (in ID_DIR) — never exposed to the browser.
ensureColumn('guests', 'id_document_file', 'TEXT');
// branches
ensureColumn('rooms', 'branch_id', 'TEXT');
ensureColumn('users', 'branch_id', 'TEXT');
ensureColumn('stays', 'branch_id', 'TEXT');
ensureColumn('orders', 'branch_id', 'TEXT');
ensureColumn('guests', 'branch_id', 'TEXT');
ensureColumn('reservations', 'branch_id', 'TEXT');
ensureColumn('housekeeping_tasks', 'branch_id', 'TEXT');
ensureColumn('maintenance_issues', 'branch_id', 'TEXT');
ensureColumn('inventory_items', 'branch_id', 'TEXT');
ensureColumn('folio_items', 'branch_id', 'TEXT');
ensureColumn('approvals', 'used_at', 'TEXT');
ensureColumn('approvals', 'used_on', 'TEXT');

// reports per branch and per day get faster with these
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_stays_branch ON stays(branch_id, status);
  CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, status);
  CREATE INDEX IF NOT EXISTS idx_folio_branch ON folio_items(branch_id, bill_date);
  CREATE INDEX IF NOT EXISTS idx_guest_requests_status ON guest_requests(status, department);
  CREATE INDEX IF NOT EXISTS idx_stock_moves_item ON stock_moves(inventory_item_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_recipe_menu ON recipe_items(menu_item_id);
`);
ensureColumn('orders', 'client_ref', 'TEXT');

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_folio_client_ref ON folio_items(client_ref) WHERE client_ref IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_ref ON orders(client_ref) WHERE client_ref IS NOT NULL;
`);

/* ---------- small helpers ---------- */

export function id(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  return parseJson(row.value, row.value);
}

export function setSetting(key, value) {
  const stored = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, stored);
}

export function allSettings() {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    out[row.key] = parseJson(row.value, row.value);
  }
  return out;
}

export function audit({ actor, action, entity, entityId, detail }) {
  db.prepare(
    `INSERT INTO audit_log (id, at, actor_id, actor_name, role, action, entity, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id('log'), nowIso(), actor?.id || null, actor?.name || 'System', actor?.role || 'system', action, entity || null, entityId || null, detail || null);
}
