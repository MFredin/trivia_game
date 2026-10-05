import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';

// "Every route that names a resource by id proves ownership, and returns 404 rather than 403 when it is not yours"
// (CLAUDE.md). A 403 tells a stranger the id exists. A duel's id is a small integer, so that would let anyone count
// duels and see which ids are real.
test('a duel is invisible to anyone who is not one of its two players', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);

  const [creator, opponent, stranger] = [await newPlayer(), await newPlayer(), await newPlayer()];
  const made = await call('/duels', { method: 'POST', token: creator.token, body: json({ opponent_username: opponent.username }) });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const id = made.body.duel_id;
  const missing = '00000000-0000-4000-8000-000000000000';

  const as = (player, path, method = 'GET') => call(`/duels/${path}`, { method, token: player.token });

  await t.test('a stranger gets the same answer as for a duel that does not exist', async () => {
    for (const [path, method] of [[id, 'GET'], [`${id}/accept`, 'POST'], [`${id}/decline`, 'POST']]) {
      const real = await as(stranger, path, method);
      const none = await as(stranger, String(path).replace(String(id), String(missing)), method);
      assert.equal(real.status, 404, `${method} ${path}`);
      assert.deepEqual(real.body, none.body, 'indistinguishable from an id that is not there');
    }
  });

  await t.test('an id that is not an id at all is a 404 too, not a server error', async () => {
    for (const path of ['not-a-uuid', 'not-a-uuid/accept']) {
      assert.equal((await as(stranger, path, path.includes('/') ? 'POST' : 'GET')).status, 404, path);
    }
  });

  await t.test('a player in the duel can see it', async () => {
    assert.equal((await as(creator, id)).status, 200);
    assert.equal((await as(opponent, id)).status, 200);
  });

  await t.test('the creator cannot accept their own invitation, and is told so', async () => {
    assert.equal((await as(creator, `${id}/accept`, 'POST')).status, 403);
    assert.equal((await as(creator, `${id}/decline`, 'POST')).status, 403);
  });

  await t.test('the invitation is still pending after the stranger\'s attempts', async () => {
    const duel = await as(opponent, id);
    assert.equal(duel.body.status, 'pending');
  });
});
