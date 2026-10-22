import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { boot, shutdown, call, newPlayer, skip, socketUrl } from './helpers/app.js';
import { TICKET_TTL_MS, redeemSocketTicket, signSocketTicket } from '../src/lib/socketTickets.js';
import { readAuthToken, signAuthToken } from '../src/lib/authTokens.js';

// A WebSocket handshake cannot carry a header, so the browser has to put something in the URL, and a URL is written down by every proxy and log between the
// player and the server. The sign-in token must never be what goes there: it works for thirty days, for the whole API. What goes there instead is a ticket
// that is good for one connection within half a minute, so a line found in a log afterwards is worth nothing.
test('a socket ticket lives half a minute, opens one connection, and is nothing else', () => {
  const now = 1_000_000;

  const ticket = signSocketTicket(7, 2, now);
  assert.deepEqual(redeemSocketTicket(ticket, now + 1000), { userId: 7, version: 2 });
  assert.equal(redeemSocketTicket(ticket, now + 2000), null, 'a second use is refused');

  assert.equal(redeemSocketTicket(signSocketTicket(7, 2, now), now + TICKET_TTL_MS + 1), null, 'after thirty seconds it is refused');
  assert.notEqual(redeemSocketTicket(signSocketTicket(7, 2, now), now + TICKET_TTL_MS - 1), null, 'just inside it is not');

  const tampered = signSocketTicket(7, 2, now).replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
  assert.equal(redeemSocketTicket(tampered, now), null);
  assert.equal(redeemSocketTicket('', now), null);
  assert.equal(redeemSocketTicket(undefined, now), null);
  assert.equal(redeemSocketTicket('a.b', now), null);
});

test('a sign-in token is not a ticket, and a ticket is not a sign-in token', () => {
  assert.equal(redeemSocketTicket(signAuthToken(7, 0)), null);
  assert.equal(readAuthToken(signSocketTicket(7, 0)), null);
});

test('the socket and its tickets', { skip }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);
  const connect = (query) =>
    new Promise((resolve) => {
      const ws = new WebSocket(socketUrl(query));
      ws.once('open', () => resolve({ opened: true, close: () => ws.close() }));
      ws.once('error', () => resolve({ opened: false }));
      ws.once('unexpected-response', () => resolve({ opened: false }));
    });

  await t.test('asking for a ticket needs a sign-in', async () => {
    assert.equal((await call('/auth/socket-ticket', { method: 'POST' })).status, 401);
  });

  await t.test('a signed-in player is given a ticket that opens a connection once', async () => {
    const a = await newPlayer();
    const res = await call('/auth/socket-ticket', { method: 'POST', token: a.token });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.ticket, 'string');
    const first = await connect(`ticket=${encodeURIComponent(res.body.ticket)}`);
    assert.equal(first.opened, true);
    first.close();
    const again = await connect(`ticket=${encodeURIComponent(res.body.ticket)}`);
    assert.equal(again.opened, false, 'the same ticket opens nothing a second time');
  });

  await t.test('the sign-in token no longer opens a socket, whichever way it is offered', async () => {
    const a = await newPlayer();
    assert.equal((await connect(`token=${encodeURIComponent(a.token)}`)).opened, false);
    assert.equal((await connect(`ticket=${encodeURIComponent(a.token)}`)).opened, false);
  });

  await t.test('a ticket from before every session was ended opens nothing', async () => {
    const a = await newPlayer();
    const res = await call('/auth/socket-ticket', { method: 'POST', token: a.token });
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [a.id]);
    assert.equal((await connect(`ticket=${encodeURIComponent(res.body.ticket)}`)).opened, false);
  });

  await t.test('a ticket for a suspended account opens nothing', async () => {
    const a = await newPlayer();
    const res = await call('/auth/socket-ticket', { method: 'POST', token: a.token });
    await pool.query(`UPDATE users SET suspended_until = now() + interval '1 day' WHERE id = $1`, [a.id]);
    assert.equal((await connect(`ticket=${encodeURIComponent(res.body.ticket)}`)).opened, false);
  });
});
