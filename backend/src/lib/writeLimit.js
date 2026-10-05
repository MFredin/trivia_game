import { readAuthToken } from './authTokens.js';
import { rateLimit } from './rateLimiter.js';

// Ten changes a second, sustained for a minute, from one signed-in player. A person playing (an answer, a lifeline,
// a message) is nowhere near it; a script flooding friend requests, suggestions or runs is stopped at it. The
// routes that need a tighter limit (sign-in, owl post, reports) keep their own, which apply first.
const WRITES_PER_MINUTE = 600;

const limiter = rateLimit({
  max: WRITES_PER_MINUTE,
  windowMs: 60_000,
  // Keyed on who the token says it is when there is one, so players behind one shared address (a school, a
  // household) are counted separately; on the address otherwise. The signature is checked here but not the
  // account: this runs before auth and must stay cheap, and a forged token only ever lands in its own bucket.
  keyFn: (req) => {
    const header = req.headers.authorization;
    const claim = header?.startsWith('Bearer ') ? readAuthToken(header.slice(7)) : null;
    return claim ? `user:${claim.userId}` : `ip:${req.ip}`;
  },
});

/** A safety net over every request that changes something. Reads are not limited here. */
export function writeLimit(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  return limiter(req, res, next);
}
