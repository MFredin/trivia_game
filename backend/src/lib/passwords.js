import crypto from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  const storedKey = Buffer.from(keyHex, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedKey);
}
