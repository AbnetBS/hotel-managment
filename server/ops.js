/**
 * Round-3 operations: everything that is not a room, an order or a payment.
 *
 *   guest requests (water, towels, laundry, taxi, checkout…)
 *   post-to-room for any hotel service
 *   maintenance with a full lifecycle
 *   approvals for sensitive actions
 *   inventory with recipes (stock follows sales)
 *   lost & found
 *   identity documents with a retention rule
 *
 * Kept apart from actions.js on purpose: the front-desk file stays readable.
 */
import { db, audit, id, nowIso, allSettings } from './db.js';
import { publish, publishToRoles } from './realtime.js';
import { verifyPin, randomToken } from './password.js';
import { rateFor, toEtb } from './fx.js';
import { postFolioItem, activeStayForRoom, roomById, createMaintenance } from './actions.js';

/* ==========================================================================
 * Guest requests from the QR code (feature 15)
 * ========================================================================== */

export const REQUEST_KINDS = {
  water: { key: 'water', label: 'Water', am: 'ውሃ', department: 'housekeeping', icon: 'droplet', free: true },
  towel: { key: 'towel', label: 'Towels / linen', am: 'ፎጣ', department: 'housekeeping', icon: 'layers', free: true },
  housekeeping: { key: 'housekeeping', label: 'Clean my room', am: 'ክፍሌን ያጽዱ', department: 'housekeeping', icon: 'broom', free: true },
  laundry: { key: 'laundry', label: 'Laundry', am: 'ልብስ ማጠቢያ', department: 'housekeeping', icon: 'shirt', priced: true },
  room_service: { key: 'room_service', label: 'Room service', am: 'የክፍል አገልግሎት', department: 'waiter', icon: 'bell', priced: true },
  maintenance: { key: 'maintenance', label: 'Something is broken', am: 'ጥገና', department: 'maintenance', icon: 'wrench', free: true },
  transportation: { key: 'transportation', label: 'Taxi / transport', am: 'ታክሲ', department: 'desk', icon: 'car', priced: true },
  checkout: { key: 'checkout', label: 'I want to check out', am: 'መውጣት እፈልጋለሁ', department: 'desk', icon: 'log-out', free: true },
  other: { key: 'other', label: 'Something else', am: 'ሌላ', department: 'desk', icon: 'message', priced: true },
};

/** Who gets rung for each department. */
const DEPARTMENT_ROLES = {
  housekeeping: ['housekeeping', 'cashier', 'manager', 'admin'],
  maintenance: ['maintenance', 'manager', 'admin', 'cashier'],
  waiter: ['waiter', 'cashier', 'manager', 'admin'],
  desk: ['cashier', 'manager', 'admin'],
};

export function createGuestRequest({ roomId, stayId, kind, note, priority, actor, source = 'qr' }) {
  const room = roomId ? roomById(roomId) : null;
  const stay = stayId
    ? db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId)
    : room
      ? activeStayForRoom(room.id)
      : null;
  const meta = REQUEST_KINDS[kind] || REQUEST_KINDS.other;
  const guest = stay ? db.prepare('SELECT * FROM guests WHERE id = ?').get(stay.guest_id) : null;
  const requestId = id('gr');

  db.prepare(`INSERT INTO guest_requests (id, stay_id, room_id, room_number, guest_name, kind, department, note, status, priority, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`).run(
    requestId, stay?.id || null, room?.id || null, room?.number || null,
    guest?.full_name || 'Guest', meta.key, meta.department, note || null,
    priority || (meta.key === 'maintenance' ? 'high' : 'normal'), nowIso(),
  );

  // A broken thing in the room is also a real maintenance ticket.
  if (meta.key === 'maintenance' && room) {
    createMaintenance({ roomId: room.id, issue: note || 'Guest reported a problem', category: 'Guest report', priority: 'high', actor });
  }

  publishToRoles(DEPARTMENT_ROLES[meta.department] || DEPARTMENT_ROLES.desk, {
    type: 'alert',
    kind: 'guest.request',
    request_kind: meta.key,
    room: room?.number,
    title: `Room ${room?.number} · ${meta.label}${note ? ` — ${note}` : ''}`,
    am: meta.am,
    note: note || null,
    at: Date.now(),
  });
  publish(['requests', 'housekeeping', 'maintenance']);

  audit({
    actor: actor || { name: guest?.full_name || 'Guest', role: 'guest' },
    action: 'guest-request', entity: 'room', entityId: room?.id,
    detail: `${meta.label}${note ? `: ${note}` : ''} (from ${source})`,
  });
  return { ok: true, request: db.prepare('SELECT * FROM guest_requests WHERE id = ?').get(requestId) };
}

export function advanceGuestRequest({ requestId, status, note, actor }) {
  const request = db.prepare('SELECT * FROM guest_requests WHERE id = ?').get(requestId);
  if (!request) return { error: 'Request not found.' };
  const next = status || (request.status === 'new' ? 'accepted' : 'done');
  if (!['accepted', 'done', 'cancelled'].includes(next)) return { error: 'Unknown request status.' };
  db.prepare('UPDATE guest_requests SET status = ?, note = COALESCE(?, note), handled_by = ?, handled_at = ? WHERE id = ?')
    .run(next, note || null, actor?.name || null, nowIso(), requestId);

  publish(['requests']);
  if (next === 'done') {
    publishToRoles(['cashier', 'manager', 'admin'], {
      type: 'alert', kind: 'guest.request.done', room: request.room_number,
      title: `Room ${request.room_number} · ${REQUEST_KINDS[request.kind]?.label || request.kind} done`,
      at: Date.now(),
    });
  }
  return { ok: true, status: next };
}

/* ==========================================================================
 * Post to room (feature 2): laundry, minibar, transport, spa — anything.
 * ========================================================================== */

export function postServiceToRoom({ stayId, serviceId, description, amount, currency, fxRate, qty = 1, note, actor }) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) return { error: 'Stay not found.' };
  if (stay.status !== 'active') return { error: 'That guest has already checked out.' };

  const service = serviceId ? db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) : null;
  const label = description || service?.name;
  if (!label) return { error: 'Say what the charge is for.' };

  const foreign = Number(amount) || 0;
  if (foreign <= 0) return { error: 'Enter an amount.' };
  const code = String(currency || stay.currency || 'ETB').toUpperCase();
  const rate = Number(fxRate) || (code === 'ETB' ? 1 : Number(stay.fx_rate) || rateFor(code));
  if (!rate) return { error: `No exchange rate for ${code}. The manager can refresh the official rates.` };

  const units = Number(qty) || 1;
  const etb = code === 'ETB' ? foreign * units : toEtb(foreign, code, rate) * units;

  const itemId = postFolioItem({
    stayId,
    kind: service?.kind || 'service',
    description: `${label}${units > 1 ? ` × ${units}` : ''}${note ? ` · ${note}` : ''}`,
    amount: Math.round(etb * 100) / 100,
    currency: code === 'ETB' ? null : code,
    fxRate: code === 'ETB' ? null : rate,
    foreignAmount: code === 'ETB' ? null : Number((foreign * units).toFixed(2)),
    station: service?.station || null,
    actor,
  });

  audit({
    actor, action: 'charge-to-room', entity: 'stay', entityId: stayId,
    detail: `${label} · ${code === 'ETB' ? `${foreign} ETB` : `${foreign * units} ${code} @ ${rate}`}`,
  });
  publish(['folios', 'stays', 'rooms', 'reports']);
  return { ok: true, itemId, etb: Math.round(etb * 100) / 100, rate, currency: code };
}

/* ==========================================================================
 * Maintenance lifecycle (feature 5)
 * ========================================================================== */

export const MAINTENANCE_FLOW = {
  open: ['assigned', 'in progress', 'fixed'],
  assigned: ['in progress', 'fixed'],
  'in progress': ['fixed'],
  fixed: ['verified', 'in progress'],
  verified: [],
  resolved: [],
};

export const MAINTENANCE_LABEL = {
  open: 'Reported',
  assigned: 'Assigned',
  'in progress': 'Being fixed',
  fixed: 'Fixed · waiting for check',
  verified: 'Verified',
  resolved: 'Done',
};

export function moveMaintenance({ issueId, status, assignee, cost, note, actor }) {
  const issue = db.prepare('SELECT * FROM maintenance_issues WHERE id = ?').get(issueId);
  if (!issue) return { error: 'Maintenance ticket not found.' };
  const allowed = MAINTENANCE_FLOW[issue.status] || [];
  const next = status || allowed[0];
  if (!next || !allowed.includes(next)) {
    return { error: `A ticket that is "${MAINTENANCE_LABEL[issue.status] || issue.status}" cannot become "${next}".` };
  }

  if (next === 'verified') {
    db.prepare("UPDATE maintenance_issues SET status = 'resolved', resolved_at = ?, verified_by = ? WHERE id = ?")
      .run(nowIso(), actor?.name || null, issueId);
    const room = roomById(issue.room_id);
    // Fixed and checked → the room is dirty, not sellable, until it is cleaned.
    if (room && ['maintenance', 'out_of_order'].includes(room.status)) {
      db.prepare("UPDATE rooms SET status = 'dirty', block_reason = NULL WHERE id = ?").run(room.id);
      db.prepare(`INSERT INTO housekeeping_tasks (id, room_id, type, assignee, priority, status, note, created_at)
                  VALUES (?, ?, 'Clean after repair', ?, 'normal', 'pending', ?, ?)`)
        .run(id('hk'), room.id, assignee || issue.assignee || 'Unassigned', `Maintenance finished — clean before selling`, nowIso());
    }
  } else {
    const stamp = next === 'in progress' ? 'started_at' : next === 'fixed' ? 'fixed_at' : null;
    if (stamp) {
      db.prepare(`UPDATE maintenance_issues SET status = ?, assignee = COALESCE(?, assignee), cost = COALESCE(?, cost), ${stamp} = ? WHERE id = ?`)
        .run(next, assignee || null, cost ?? null, nowIso(), issueId);
    } else {
      db.prepare('UPDATE maintenance_issues SET status = ?, assignee = COALESCE(?, assignee), cost = COALESCE(?, cost) WHERE id = ?')
        .run(next, assignee || null, cost ?? null, issueId);
    }
  }

  audit({ actor, action: 'maintenance', entity: 'maintenance', entityId: issueId, detail: `${issue.issue} → ${MAINTENANCE_LABEL[next] || next}${note ? ` (${note})` : ''}` });
  publish(['maintenance', 'rooms', 'housekeeping']);
  if (next === 'fixed' || next === 'verified') {
    publishToRoles(['manager', 'admin', 'cashier'], {
      type: 'alert', kind: 'maintenance.update', room: issue.room_number,
      title: `Maintenance ${MAINTENANCE_LABEL[next]}: ${issue.issue}`, at: Date.now(),
    });
  }
  return { ok: true, status: next };
}

/** Same room, same problem, again? The manager wants to see that pattern. */
export function maintenanceHistory({ roomId }) {
  const issues = db.prepare('SELECT * FROM maintenance_issues WHERE room_id = ? ORDER BY created_at DESC').all(roomId);
  const byCategory = {};
  for (const issue of issues) {
    const key = String(issue.category || 'General');
    byCategory[key] = (byCategory[key] || 0) + 1;
  }
  return {
    total: issues.length,
    by_category: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    repeated: Object.entries(byCategory).some(([, count]) => count >= 3),
    issues,
  };
}

/* ==========================================================================
 * Feature 8: a manager must approve discounts and voids
 * ========================================================================== */

export function requireApproval({ kind, detail, amount, managerUsername, managerPin, actor }) {
  const manager = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1').get(String(managerUsername || '').trim());
  if (!manager) return { error: 'No manager account with that username.' };
  if (!['manager', 'admin'].includes(manager.role)) {
    return { error: `${manager.name} is not a manager — approval has to come from a manager or the owner.` };
  }
  if (!verifyPin(managerPin, manager.pin_hash, manager.pin_salt)) return { error: 'Wrong manager PIN.' };

  const approvalId = id('ap');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO approvals (id, kind, detail, amount, approved_by, requested_by, created_at, expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    approvalId, kind, detail || null, amount ?? null, manager.name, actor?.name || null, nowIso(), expiresAt,
  );
  audit({
    actor: { id: manager.id, name: manager.name, role: manager.role },
    action: 'approval', entity: kind, entityId: approvalId,
    detail: `${kind}${detail ? ` · ${detail}` : ''}${amount ? ` · ${amount}` : ''} (asked by ${actor?.name || 'staff'})`,
  });
  return { ok: true, approvalId, approvedBy: manager.name, expiresAt, token: randomToken() };
}

/** Has this approval been granted (and not used up)? */
export function takeApproval({ approvalId }) {
  if (!approvalId) return null;
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export function discountNeedsApproval({ amount, percent }) {
  const settings = allSettings();
  const limitPercent = Number(settings.discount_limit_percent ?? 10);
  const limitAmount = Number(settings.discount_limit_amount ?? 1500);
  return Number(amount) > limitAmount || Number(percent) > limitPercent;
}

/* ==========================================================================
 * Inventory & recipes (features 11 + 12)
 * ========================================================================== */

/** Deduct the recipe of an item that has just been made / delivered. */
export function consumeRecipe({ menuItemId, qty = 1, reference, actor }) {
  if (!menuItemId) return { ok: true, deducted: 0 };
  const recipe = db.prepare('SELECT * FROM recipe_items WHERE menu_item_id = ?').all(menuItemId);
  if (!recipe.length) return { ok: true, deducted: 0 };
  const lines = [];
  for (const line of recipe) {
    const need = Number(line.qty) * (Number(qty) || 1);
    if (!need) continue;
    db.prepare('UPDATE inventory_items SET stock = stock - ?, updated_at = ? WHERE id = ?').run(need, nowIso(), line.inventory_item_id);
    db.prepare('INSERT INTO stock_moves (id, inventory_item_id, qty, kind, reference, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id('sm'), line.inventory_item_id, -need, 'usage', reference || null, actor?.name || null, nowIso());
    lines.push({ inventory_item_id: line.inventory_item_id, qty: -need });
  }
  publish(['inventory']);
  return { ok: true, deducted: lines.length, lines };
}

export function adjustStock({ inventoryItemId, qty, kind = 'adjust', note, actor }) {
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(inventoryItemId);
  if (!item) return { error: 'Item not found.' };
  const delta = Number(qty) || 0;
  if (!delta) return { error: 'Enter how much to add or take away.' };
  db.prepare('UPDATE inventory_items SET stock = stock + ?, updated_at = ? WHERE id = ?').run(delta, nowIso(), inventoryItemId);
  db.prepare('INSERT INTO stock_moves (id, inventory_item_id, qty, kind, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id('sm'), inventoryItemId, delta, kind, note || null, actor?.name || null, nowIso());
  audit({ actor, action: 'stock', entity: 'inventory', entityId: inventoryItemId, detail: `${item.name} ${delta > 0 ? '+' : ''}${delta} ${item.unit} (${kind})` });
  publish(['inventory']);
  return { ok: true, stock: Number((item.stock + delta).toFixed(3)) };
}

/** How long the shelf lasts, from the last week of real usage. */
export function stockForecast() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  return db.prepare('SELECT * FROM inventory_items WHERE active = 1 ORDER BY name').all().map((item) => {
    const used = db
      .prepare('SELECT COALESCE(SUM(ABS(qty)), 0) AS used FROM stock_moves WHERE inventory_item_id = ? AND qty < 0 AND created_at >= ?')
      .get(item.id, since).used;
    const perDay = used / 7;
    const daysLeft = perDay > 0 ? Number((item.stock / perDay).toFixed(1)) : null;
    return {
      ...item,
      used_last_7d: Number(used.toFixed(3)),
      per_day: Number(perDay.toFixed(3)),
      days_left: daysLeft,
      low: item.stock <= item.min_stock,
      runs_out_soon: daysLeft !== null && daysLeft <= 3,
      value: Number((item.stock * (item.cost || 0)).toFixed(2)),
    };
  });
}

/** What one plate costs, from its recipe. Used for margin reporting. */
export function menuItemCost(menuItemId) {
  const rows = db
    .prepare(`SELECT r.qty, i.cost, i.name, i.unit FROM recipe_items r
              JOIN inventory_items i ON i.id = r.inventory_item_id
              WHERE r.menu_item_id = ?`)
    .all(menuItemId);
  return rows.map((row) => ({ ...row, cost: Number((row.qty * (row.cost || 0)).toFixed(2)) }));
}

export function setRecipe({ menuItemId, lines = [], actor }) {
  const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(menuItemId);
  if (!menuItem) return { error: 'Menu item not found.' };
  db.prepare('DELETE FROM recipe_items WHERE menu_item_id = ?').run(menuItemId);
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    if (!line.inventory_item_id || qty <= 0) continue;
    db.prepare('INSERT INTO recipe_items (id, menu_item_id, inventory_item_id, qty) VALUES (?, ?, ?, ?)')
      .run(id('rc'), menuItemId, line.inventory_item_id, qty);
  }
  audit({ actor, action: 'recipe', entity: 'menu_item', entityId: menuItemId, detail: `${menuItem.name}: ${lines.length} ingredient line(s)` });
  publish(['menu', 'inventory']);
  return { ok: true, lines: lines.length };
}

export function requestPurchase({ inventoryItemId, qty, note, actor }) {
  const item = inventoryItemId ? db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(inventoryItemId) : null;
  const requestId = id('pr');
  db.prepare(`INSERT INTO purchase_requests (id, inventory_item_id, name, qty, unit, status, note, created_at, created_by)
              VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`).run(
    requestId, item?.id || null, item?.name || 'Unlisted item', Number(qty) || 0, item?.unit || 'pcs', note || null, nowIso(), actor?.name || null,
  );
  audit({ actor, action: 'purchase-request', entity: 'inventory', entityId: item?.id || null, detail: `${item?.name || 'item'} × ${qty}` });
  publish(['inventory']);
  return { ok: true, id: requestId };
}

/* ==========================================================================
 * Lost & found (feature 16)
 * ========================================================================== */

export function recordLostItem({ item, description, location, roomId, foundBy, guestName, storage, actor }) {
  if (!item) return { error: 'What did you find?' };
  const foundId = id('lf');
  db.prepare(`INSERT INTO lost_found (id, item, description, found_at, location, room_id, found_by, guest_name, storage, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?)`).run(
    foundId, item, description || null, nowIso(), location || null, roomId || null,
    foundBy || actor?.name || null, guestName || null, storage || null, nowIso(),
  );
  audit({ actor, action: 'lost-found', entity: 'lost_found', entityId: foundId, detail: `${item} found in ${location || 'unknown place'}` });
  publish(['lostfound']);
  return { ok: true, id: foundId };
}

export function updateLostItem({ foundId, status, storage, returnedTo, actor }) {
  const row = db.prepare('SELECT * FROM lost_found WHERE id = ?').get(foundId);
  if (!row) return { error: 'Item not found.' };
  const next = status || row.status;
  if (!['stored', 'returned', 'disposed'].includes(next)) return { error: 'Unknown status.' };
  db.prepare(`UPDATE lost_found SET status = ?, storage = COALESCE(?, storage), returned_to = COALESCE(?, returned_to),
              returned_at = CASE WHEN ? IN ('returned', 'disposed') THEN ? ELSE returned_at END WHERE id = ?`)
    .run(next, storage || null, returnedTo || null, next, nowIso(), foundId);
  audit({ actor, action: 'lost-found', entity: 'lost_found', entityId: foundId, detail: `${row.item} → ${next}${returnedTo ? ` to ${returnedTo}` : ''}` });
  publish(['lostfound']);
  return { ok: true, status: next };
}

/* ==========================================================================
 * Identity documents (feature 19)
 * ========================================================================== */

export function saveIdDocument({ guestId, url, actor }) {
  db.prepare('UPDATE guests SET id_document_url = ?, id_document_at = ?, id_document_by = ? WHERE id = ?')
    .run(url, nowIso(), actor?.name || null, guestId);
  audit({ actor, action: 'id-document', entity: 'guest', entityId: guestId, detail: 'Identity document stored' });
  publish(['stays', 'folios']);
  return { ok: true };
}

/** Retention: the scan does not live forever. */
export function purgeIdDocuments({ olderThanDays = 90, actor }) {
  const cutoff = new Date(Date.now() - Number(olderThanDays) * 86400000).toISOString();
  const rows = db.prepare('SELECT id FROM guests WHERE id_document_url IS NOT NULL AND id_document_at < ?').all(cutoff);
  for (const row of rows) {
    db.prepare('UPDATE guests SET id_document_url = NULL, id_document_at = NULL, id_document_by = NULL WHERE id = ?').run(row.id);
  }
  if (rows.length) {
    audit({ actor, action: 'id-document-purge', entity: 'guest', entityId: null, detail: `${rows.length} document(s) older than ${olderThanDays} days deleted` });
  }
  return { ok: true, purged: rows.length };
}
