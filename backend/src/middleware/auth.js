import { verifyAuthToken } from '../lib/authTokens.js';
import { pool } from '../db/pool.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export function requireAuth(req, res, next) {
  const userId = verifyAuthToken(extractToken(req));
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  req.userId = userId;
  next();
}

export function optionalAuth(req, res, next) {
  const userId = verifyAuthToken(extractToken(req));
  req.userId = userId ?? null;
  next();
}

// Auth tokens only encode user_id (see lib/authTokens.js) — role isn't in the token, so admin
// status is looked up fresh on every request rather than trusted from anything client-supplied.
// Mount after requireAuth on any route it protects.
export async function requireAdmin(req, res, next) {
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]?.is_admin) return res.status(403).json({ error: 'forbidden' });
  next();
}
