import { db, nowIso } from './db.js';
import { verifyPin } from './password.js';

const sessions = new Map(); // token -> { userId, role, createdAt }
const SESSION_TTL = 12 * 60 * 60 * 1000;

export function publicUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, username: row.username, role: row.role, phone: row.phone };
}

export function login(username, pin) {
  const row = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1').get(String(username || '').trim());
  if (!row) return { error: 'No active staff account with that username.' };
  if (!verifyPin(pin, row.pin_hash, row.pin_salt)) return { error: 'Wrong PIN. Please try again.' };
  const token = `${row.id}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
  sessions.set(token, { userId: row.id, role: row.role, createdAt: Date.now() });
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), row.id);
  return { token, user: publicUser(row) };
}

export function logout(token) {
  sessions.delete(token);
}

export function userForToken(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
  if (!row || !row.active) return null;
  return publicUser(row);
}

export function tokenFromRequest(req) {
  return req.get('x-clove-token') || req.query.token || null;
}

export function requireAuth(req, res, next) {
  const user = userForToken(tokenFromRequest(req));
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in again.' });
    if (roles.length && !roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Your role cannot do this action.' });
    }
    next();
  };
}

/** Roles that may take money / post charges to a guest bill. */
export const MONEY_ROLES = ['cashier', 'admin', 'manager'];
