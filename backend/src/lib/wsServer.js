import { WebSocketServer } from 'ws';
import { verifyAuthToken } from './authTokens.js';
import { markOnline, markOffline, getSockets } from './presenceRegistry.js';
import { isDuelReaction, allowReaction } from './duelReactions.js';
import { pool } from '../db/pool.js';

// The largest frame worth parsing. A reaction is a few dozen bytes; anything approaching this
// is not one, and refusing it early keeps a malformed or hostile client from handing us a
// megabyte to JSON.parse.
const MAX_FRAME_BYTES = 1024;

// Browsers can't set custom headers on a WebSocket handshake, so the auth token travels as a
// query param instead — same trust level as the header-based Bearer token used everywhere else.
export function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const userId = verifyAuthToken(url.searchParams.get('token'));
    if (!userId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = userId;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    markOnline(ws.userId, ws);
    // Until reactions, this socket was push-only. It now accepts exactly one kind of inbound
    // frame, and every other shape is dropped without a reply.
    ws.on('message', (raw) => {
      handleClientFrame(ws, raw).catch(() => {});
    });
    ws.on('close', () => markOffline(ws.userId, ws));
    ws.on('error', () => markOffline(ws.userId, ws));
  });

  return wss;
}

// The sender is ws.userId, set during the authenticated handshake — never taken from the
// frame — so a client cannot react as somebody else. Membership of the duel is checked against
// the database every time rather than trusted from the payload.
async function handleClientFrame(ws, raw) {
  if (raw.length > MAX_FRAME_BYTES) return;

  let event;
  try {
    event = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (event?.type !== 'duel:react') return;
  if (!isDuelReaction(event.reaction)) return;
  if (typeof event.duel_id !== 'string') return;
  if (!allowReaction(ws)) return;

  const { rows } = await pool.query(
    // 'active' only. A duel is pending until the invite is accepted, and once it is
    // completed there is no live game left to react to.
    `SELECT created_by, opponent_id FROM duels WHERE id = $1 AND status = 'active'`,
    [event.duel_id],
  );
  const duel = rows[0];
  if (!duel) return;

  const participants = [duel.created_by, duel.opponent_id];
  if (!participants.includes(ws.userId)) return;
  const opponentId = participants.find((id) => id !== ws.userId);
  if (!opponentId) return;

  const { rows: userRows } = await pool.query('SELECT username FROM users WHERE id = $1', [ws.userId]);

  // Relayed, never stored. A reaction is a thing said during a duel, not a record of it, so
  // there is nothing to retain, export or moderate after the fact.
  sendToUser(opponentId, {
    type: 'duel:reaction',
    duel_id: event.duel_id,
    from_username: userRows[0]?.username ?? null,
    reaction: event.reaction,
  });
}

export function sendToUser(userId, event) {
  const payload = JSON.stringify(event);
  for (const ws of getSockets(userId)) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
