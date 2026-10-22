// The ticket that opens a WebSocket. A browser cannot put a header on a WebSocket handshake, so whatever proves who is connecting has to travel in the URL,
// and every proxy and log between the player and the server writes a URL down. The sign-in token must not be what is written: it works for thirty days, for
// the whole API. So a player who wants a socket asks for a ticket (POST /api/auth/socket-ticket, with the token as a header, where it belongs), and the
// ticket is what goes in the URL: it is good for thirty seconds and for one connection, and it is signed under a different label from a sign-in token,
// so neither can stand in for the other. A line found in a log afterwards opens nothing.
//
// Used tickets are remembered in memory until they would have expired anyway. That is enough because there is one server process; with several, a ticket
// could be used once on each, still only within the half minute, and this is where a shared store would go.

import crypto from 'node:crypto';
import { AUTH_TOKEN_SECRET } from './secrets.js';

export const TICKET_TTL_MS = 30 * 1000;

const spent = new Map();

const mac = (encoded) => crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(`socket-ticket:${encoded}`).digest('hex');

export function signSocketTicket(userId, version = 0, now = Date.now()) {
  const payload = { u: userId, v: version, e: now + TICKET_TTL_MS, j: crypto.randomBytes(9).toString('base64url') };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${mac(encoded)}`;
}

/** Who a ticket is for and which generation of sign-ins it belongs to, once; null if it is forged, expired, malformed or already used. */
export function redeemSocketTicket(ticket, now = Date.now()) {
  if (typeof ticket !== 'string') return null;
  const [encoded, signature, ...rest] = ticket.split('.');
  if (!encoded || !signature || rest.length) return null;

  const expected = Buffer.from(mac(encoded), 'hex');
  const got = Buffer.from(signature, 'hex');
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
  if (!Number.isInteger(payload.u) || !Number.isInteger(payload.v) || typeof payload.j !== 'string' || !(payload.e > now)) return null;

  for (const [id, expires] of spent) if (expires <= now) spent.delete(id);
  if (spent.has(payload.j)) return null;
  spent.set(payload.j, payload.e);
  return { userId: payload.u, version: payload.v };
}
