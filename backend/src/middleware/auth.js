import { verifyAuthToken } from '../lib/authTokens.js';

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
