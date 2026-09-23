/** Admin API: the things only an owner/manager can change. */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, audit, id, nowIso, setSetting, allSettings, UPLOAD_DIR } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { hashPin, randomToken } from './password.js';
import * as repo from './repo.js';
import { publish } from './realtime.js';
import { loginPauses, clearLoginPauses } from './security.js';

export const admin = express.Router();

admin.use(requireAuth, requireRole('manager', 'admin'));

const json = (value) => (value === undefined ? null : JSON.stringify(value));
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
};

/* ------------------------------ room types ------------------------------- */

admin.post('/room-types', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Room type needs a name.' });
  const rid = id('rt');
  db.prepare(`INSERT INTO room_types (id, name, description, billing_mode, nightly_rate, hourly_rate, dayuse_rate, dayuse_hours,
      max_guests, beds, amenities, photos, active, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
    rid, b.name, b.description || '', b.billing_mode || 'nightly', Number(b.nightly_rate) || 0, Number(b.hourly_rate) || 0,
    Number(b.dayuse_rate) || 0, Number(b.dayuse_hours) || 3, Number(b.max_guests) || 2, b.beds || '',
    json(b.amenities || []), json(b.photos || []), Number(b.sort) || 99,
  );
  audit({ actor: req.user, action: 'room-type-create', entity: 'room_type', entityId: rid, detail: b.name });
  publish(['rooms', 'roomTypes']);
  res.json({ roomType: repo.roomTypeById(rid) });
});

admin.patch('/room-types/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Room type not found.' });
  const b = clean(req.body);
  const fields = ['name', 'description', 'billing_mode', 'nightly_rate', 'hourly_rate', 'dayuse_rate', 'dayuse_hours', 'max_guests', 'beds', 'active', 'sort'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'active' ? (b[f] ? 1 : 0) : b[f]);
    }
  }
  if (b.amenities !== undefined) {
    updates.push('amenities = ?');
    params.push(json(b.amenities));
  }
  if (b.photos !== undefined) {
    updates.push('photos = ?');
    params.push(json(b.photos));
  }
  if (!updates.length) return res.json({ roomType: repo.roomTypeById(req.params.id) });
  params.push(req.params.id);
  db.prepare(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  audit({ actor: req.user, action: 'room-type-update', entity: 'room_type', entityId: req.params.id, detail: Object.keys(b).join(', ') });
  publish(['rooms', 'roomTypes']);
  res.json({ roomType: repo.roomTypeById(req.params.id) });
});

admin.delete('/room-types/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE room_type_id = ?').get(req.params.id).n;
  if (used) return res.status(400).json({ error: `${used} room(s) still use this type. Move them first.` });
  db.prepare('DELETE FROM room_types WHERE id = ?').run(req.params.id);
  publish(['rooms', 'roomTypes']);
  res.json({ ok: true });
});

/* -------------------------------- rooms ---------------------------------- */

admin.post('/rooms', (req, res) => {
  const b = req.body || {};
  if (!b.number) return res.status(400).json({ error: 'Room number is required.' });
  if (db.prepare('SELECT 1 FROM rooms WHERE number = ?').get(String(b.number))) {
    return res.status(400).json({ error: `Room ${b.number} already exists.` });
  }
  const rid = id('r');
  db.prepare('INSERT INTO rooms (id, number, floor, room_type_id, status, billing_mode, qr_token, note, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(rid, String(b.number), Number(b.floor) || 1, b.room_type_id || null, b.status || 'available', b.billing_mode || null,
      randomToken(8), b.note || null, Number(b.sort) || 0);
  audit({ actor: req.user, action: 'room-create', entity: 'room', entityId: rid, detail: `Room ${b.number}` });
  publish(['rooms']);
  res.json({ room: repo.rooms().find((r) => r.id === rid) });
});

admin.patch('/rooms/:id', (req, res) => {
  const b = clean(req.body);
  const fields = ['number', 'floor', 'room_type_id', 'status', 'billing_mode', 'note', 'block_reason', 'sort'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(b[f]);
    }
  }
  if (b.regenerate_qr) {
    updates.push('qr_token = ?');
    params.push(randomToken(8));
  }
  if (!updates.length) return res.json({ ok: true });
  params.push(req.params.id);
  db.prepare(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  audit({ actor: req.user, action: 'room-update', entity: 'room', entityId: req.params.id, detail: Object.keys(b).join(', ') });
  publish(['rooms']);
  res.json({ room: repo.rooms().find((r) => r.id === req.params.id) });
});

admin.delete('/rooms/:id', (req, res) => {
  const active = db.prepare("SELECT COUNT(*) AS n FROM stays WHERE room_id = ? AND status = 'active'").get(req.params.id).n;
  if (active) return res.status(400).json({ error: 'This room has a guest checked in.' });
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  publish(['rooms']);
  res.json({ ok: true });
});

/* --------------------------------- menu ---------------------------------- */

admin.post('/menu/categories', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Category needs a name.' });
  const cid = id('mc');
  db.prepare('INSERT INTO menu_categories (id, name, name_am, station, sort, active) VALUES (?, ?, ?, ?, ?, 1)')
    .run(cid, b.name, b.name_am || null, b.station || 'kitchen', Number(b.sort) || 99);
  publish(['menu']);
  res.json({ ok: true, id: cid });
});

admin.patch('/menu/categories/:id', (req, res) => {
  db.prepare('UPDATE menu_categories SET name = COALESCE(?, name), name_am = COALESCE(?, name_am), station = COALESCE(?, station), active = COALESCE(?, active) WHERE id = ?')
    .run(req.body?.name ?? null, req.body?.name_am ?? null, req.body?.station ?? null,
      req.body?.active === undefined ? null : (req.body.active ? 1 : 0), req.params.id);
  publish(['menu']);
  res.json({ ok: true });
});

admin.delete('/menu/categories/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM menu_items WHERE category_id = ?').get(req.params.id).n;
  if (used) return res.status(400).json({ error: `${used} item(s) are still in this category.` });
  db.prepare('DELETE FROM menu_categories WHERE id = ?').run(req.params.id);
  publish(['menu']);
  res.json({ ok: true });
});

/** Which station an item belongs to is the admin's call — kitchen, barista, juice or bar. */
admin.post('/menu/items', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Item needs a name.' });
  const mid = id('mi');
  db.prepare(`INSERT INTO menu_items (id, name, name_am, description, price, category_id, station, prep_minutes, available, emoji, sort)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    mid, b.name, b.name_am || null, b.description || '', Number(b.price) || 0, b.category_id || null,
    b.station || 'kitchen', Number(b.prep_minutes) || 15, b.emoji || '🍽️', Number(b.sort) || 99,
  );
  publish(['menu']);
  res.json({ ok: true, id: mid });
});

admin.patch('/menu/items/:id', (req, res) => {
  const b = req.body || {};
  const fields = ['name', 'name_am', 'description', 'price', 'category_id', 'station', 'prep_minutes', 'available', 'emoji', 'sort'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'available' ? (b[f] ? 1 : 0) : b[f]);
    }
  }
  if (!updates.length) return res.json({ ok: true });
  params.push(req.params.id);
  db.prepare(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  publish(['menu']);
  res.json({ ok: true });
});

admin.delete('/menu/items/:id', (req, res) => {
  db.prepare('UPDATE menu_items SET available = 0 WHERE id = ?').run(req.params.id);
  publish(['menu']);
  res.json({ ok: true, note: 'Item moved out of the menu (history stays on old bills).' });
});

/* --------------------------------- staff --------------------------------- */

admin.get('/users', (req, res) => res.json({ users: repo.users() }));

admin.post('/users', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.username || !b.pin) return res.status(400).json({ error: 'Name, username and PIN are required.' });
  if (String(b.pin).length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
  if (db.prepare('SELECT 1 FROM users WHERE lower(username) = lower(?)').get(b.username)) {
    return res.status(400).json({ error: 'That username is already taken.' });
  }
  const uid = id('u');
  const { hash, salt } = hashPin(String(b.pin));
  db.prepare('INSERT INTO users (id, name, username, pin_hash, pin_salt, role, phone, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
    .run(uid, b.name, b.username, hash, salt, b.role || 'cashier', b.phone || null, nowIso());
  audit({ actor: req.user, action: 'staff-create', entity: 'user', entityId: uid, detail: `${b.name} (${b.role})` });
  publish(['users']);
  res.json({ ok: true, id: uid });
});

admin.patch('/users/:id', (req, res) => {
  const b = req.body || {};
  const updates = [];
  const params = [];
  for (const f of ['name', 'role', 'phone']) {
    if (b[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(b[f]);
    }
  }
  if (b.active !== undefined) {
    updates.push('active = ?');
    params.push(b.active ? 1 : 0);
  }
  if (b.username) {
    updates.push('username = ?');
    params.push(b.username);
  }
  if (b.pin) {
    const { hash, salt } = hashPin(String(b.pin));
    updates.push('pin_hash = ?', 'pin_salt = ?');
    params.push(hash, salt);
  }
  if (!updates.length) return res.json({ ok: true });
  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  audit({ actor: req.user, action: 'staff-update', entity: 'user', entityId: req.params.id, detail: Object.keys(b).join(', ') });
  publish(['users']);
  res.json({ ok: true });
});

admin.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true, note: 'Account disabled (kept in the audit history).' });
});

/* -------------------- the guest registration form builder ---------------- */

admin.get('/registration-fields', (req, res) => res.json({ fields: repo.registrationFields({ onlyActive: false }) }));

function saveFields(list) {
  db.prepare('UPDATE registration_fields SET active = 0').run();
  list.forEach((f, i) => {
    const meta = f.type === 'select' ? { options: f.options || [] } : f.default ? { default: f.default } : null;
    if (f.id && db.prepare('SELECT 1 FROM registration_fields WHERE id = ?').get(f.id)) {
      db.prepare(`UPDATE registration_fields SET key = ?, label = ?, label_am = ?, type = ?, required = ?, options = ?, placeholder = ?, sort = ?, active = 1 WHERE id = ?`)
        .run(f.key, f.label, f.label_am || null, f.type || 'text', f.required ? 1 : 0, json(meta), f.placeholder || null, i, f.id);
    } else {
      db.prepare(`INSERT INTO registration_fields (id, key, label, label_am, type, required, options, placeholder, sort, active)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
        id('rf'), f.key || `field_${i}`, f.label, f.label_am || null, f.type || 'text', f.required ? 1 : 0,
        json(meta), f.placeholder || null, i,
      );
    }
  });
  publish(['registrationFields']);
}

admin.post('/registration-fields', (req, res) => {
  const fields = req.body?.fields || [];
  if (!Array.isArray(fields)) return res.status(400).json({ error: 'Send the full list of fields.' });
  saveFields(fields);
  audit({ actor: req.user, action: 'form-update', entity: 'registration_fields', detail: `${fields.length} fields` });
  res.json({ fields: repo.registrationFields({ onlyActive: false }) });
});

admin.delete('/registration-fields/:id', (req, res) => {
  db.prepare('DELETE FROM registration_fields WHERE id = ?').run(req.params.id);
  publish(['registrationFields']);
  res.json({ fields: repo.registrationFields({ onlyActive: false }) });
});

/* -------------------------------- settings ------------------------------- */

admin.patch('/settings', (req, res) => {
  const b = req.body || {};
  const editable = ['hotel_name', 'property_line', 'property_code', 'phone', 'address', 'currency', 'vat_percent', 'service_charge_percent',
    'checkout_hour', 'grace_hours', 'wifi_name', 'wifi_password', 'receipt_footer', 'dayuse_default_hours', 'alert_sound', 'require_call_confirmation'];
  for (const key of editable) {
    if (b[key] !== undefined) setSetting(key, b[key]);
  }
  audit({ actor: req.user, action: 'settings-update', entity: 'settings', detail: Object.keys(b).join(', ') });
  publish(['settings']);
  res.json({ settings: allSettings() });
});

/* -------------------------------- uploads -------------------------------- */

admin.post('/uploads', (req, res) => {
  const { data_url: dataUrl, filename } = req.body || {};
  if (!dataUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) {
    return res.status(400).json({ error: 'Upload a PNG, JPG or WEBP image.' });
  }
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'Image is larger than 6 MB.' });
  const ext = (dataUrl.match(/^data:image\/(\w+)/) || [, 'jpg'])[1].replace('jpeg', 'jpg');
  const safe = `${Date.now()}-${String(filename || 'photo').replace(/[^a-z0-9.]/gi, '-').slice(0, 40)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, safe), buffer);
  res.json({ url: `/uploads/${safe}` });
});

/* --------------------------------- audit --------------------------------- */

admin.get('/audit', (req, res) => res.json({ log: repo.auditLog({ limit: Number(req.query.limit) || 150 }) }));

/* ------------------------- paused sign-in attempts ----------------------- */

/** Who the sign-in guard paused, so a manager can put people back to work. */
admin.get('/login-pauses', (req, res) => res.json({ pauses: loginPauses() }));

admin.post('/login-pauses/clear', (req, res) => {
  const cleared = clearLoginPauses(req.body?.username);
  audit({ actor: req.user, action: 'login-pause-cleared', entity: 'user', entityId: null, detail: req.body?.username ? `Cleared pause for ${req.body.username}` : `Cleared ${cleared} paused sign-in(s)` });
  res.json({ ok: true, cleared });
});

/* ------------------------------ folio edit ------------------------------- */

admin.post('/folio-items/:id/void', (req, res) => {
  const item = db.prepare('SELECT * FROM folio_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Charge not found.' });
  db.prepare('UPDATE folio_items SET void = 1 WHERE id = ?').run(req.params.id);
  audit({ actor: req.user, action: 'void-charge', entity: 'folio_item', entityId: req.params.id, detail: item.description });
  publish(['folios', 'stays']);
  res.json({ ok: true });
});
