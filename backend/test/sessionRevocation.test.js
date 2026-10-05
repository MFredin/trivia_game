import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.RECOVERY_RATE_LIMIT_MAX = '1000';

import { boot, shutdown, call, json, newPlayer, connectSocket, settle, skip } from './helpers/app.js';
import { outbox } from '../src/lib/mailer.js';

test('changing or resetting a password ends every other session', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);

  const me = (token) => call('/auth/me', { token });
  const login = async (email, password) => (await call('/auth/login', { method: 'POST', body: json({ email, password }) })).body.token;

  await t.test('a password change signs out the other devices, and hands this one a token that still works', async () => {
    const player = await newPlayer();
    const phone = await login(player.email, 'password123');
    const laptop = await login(player.email, 'password123');
    assert.equal((await me(phone)).status, 200);
    assert.equal((await me(laptop)).status, 200);

    const changed = await call('/account/password', {
      method: 'PATCH',
      token: laptop,
      body: json({ current_password: 'password123', new_password: 'a-new-password' }),
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.body.token && changed.body.token !== laptop, 'a fresh token comes back');

    assert.equal((await me(phone)).status, 401, 'the other device is out');
    assert.equal((await me(laptop)).status, 401, 'so is the token this request was made with');
    assert.equal((await me(changed.body.token)).status, 200, 'the fresh one is good');
    assert.equal((await me(await login(player.email, 'a-new-password'))).status, 200, 'and so is a new login');
  });

  await t.test('a refused change does not end anything', async () => {
    const player = await newPlayer();
    await call('/account/password', {
      method: 'PATCH',
      token: player.token,
      body: json({ current_password: 'not-it', new_password: 'a-new-password' }),
    });
    assert.equal((await me(player.token)).status, 200);
  });

  await t.test('a reset from the emailed link ends all of them', async () => {
    const player = await newPlayer();
    const device = await login(player.email, 'password123');
    await call('/auth/password-reset/request', { method: 'POST', body: json({ email: player.email }) });
    const mail = outbox.filter((m) => m.to === player.email).at(-1);
    const token = new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('reset');
    assert.equal((await call('/auth/password-reset/confirm', { method: 'POST', body: json({ token, password: 'a-new-password' }) })).status, 204);
    assert.equal((await me(device)).status, 401);
    assert.equal((await me(player.token)).status, 401, 'a token that never had a version is out as well');
  });

  await t.test('an old token cannot open a socket, and the open sockets are closed', async () => {
    const player = await newPlayer();
    const socket = await connectSocket(player);
    const closed = new Promise((resolve) => socket.ws.once('close', resolve));
    const changed = await call('/account/password', {
      method: 'PATCH',
      token: player.token,
      body: json({ current_password: 'password123', new_password: 'a-new-password' }),
    });
    await Promise.race([closed, settle(2000).then(() => assert.fail('the socket was left open'))]);
    await assert.rejects(connectSocket(player), 'the old token no longer opens a socket');
    const fresh = await connectSocket({ ...player, token: changed.body.token });
    fresh.close();
  });
});
