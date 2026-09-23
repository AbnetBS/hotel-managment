import crypto from 'node:crypto';

/** PIN / password hashing for staff logins. */
export function hashPin(pin, salt = crypto.randomBytes(12).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { hash, salt };
}

export function verifyPin(pin, hash, salt) {
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(String(hash), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function randomToken(len = 10) {
  return crypto.randomBytes(24).toString('base64url').slice(0, len);
}
