import { verifyAuthToken } from '../lib/authTokens.js';
import { pool } from '../db/pool.js';
import { getAccountAccess, isActiveUser, restrictionNote } from '../repo/users.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

// A valid signature is not enough: tokens last thirty days and cannot be revoked, so a deleted,
// suspended or banned account's token still verifies. Checking the account on every request is
// what makes those take effect at once rather than whenever the token happens to expire.
export async function requireAuth(req, res, next) {
  const userId = verifyAuthToken(extractToken(req));
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const access = await getAccountAccess(userId);
    if (access.state === 'gone') return res.status(401).json({ error: 'unauthorized' });
    // 403, not 401: the token is good and the person is known — they are not allowed in. A 401
    // would make the app sign them out and forget why; this lets it say.
    if (access.state === 'suspended' || access.state === 'banned') {
      return res.status(403).json({
        error: access.state === 'banned' ? 'account_banned' : 'account_suspended',
        until: access.until,
        note: await restrictionNote(userId),
      });
    }
  } catch (err) {
    return next(err);
  }
  req.userId = userId;
  next();
}

export async function optionalAuth(req, res, next) {
  const userId = verifyAuthToken(extractToken(req));
  try {
    req.userId = userId && (await isActiveUser(userId)) ? userId : null;
  } catch (err) {
    return next(err);
  }
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
