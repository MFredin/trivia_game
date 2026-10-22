import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, newPlayer, skip } from './helpers/app.js';
import { readAuthToken, signAuthToken } from '../src/lib/authTokens.js';

// Ending sessions in bulk, for the day a credential may have been seen by someone it should not have been (docs/secret-rotation.md). Rotating the signing
// secret does the same thing; this is the lever that works without a deploy, and it also ends the links sent by email. The tests end the sessions of the
// players they made, never everyone's: every test file shares one database and runs at the same time, and signing out everyone would sign out all of them.
test('revoking sessions in bulk', { skip }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);
  const { revokeSessions } = await import('../src/services/sessionRevocation.js');
  const { getAccountAccess } = await import('../src/repo/users.js');

  const versionOf = async (id) => (await pool.query('SELECT token_version FROM users WHERE id = $1', [id])).rows[0].token_version;

  await t.test('every token signed before it stops working, on the very next request', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    for (const player of [a, b]) assert.equal((await call('/auth/me', { token: player.token })).status, 200);

    await revokeSessions(pool, { only: [a.id, b.id] });

    for (const player of [a, b]) {
      const claimed = readAuthToken(player.token);
      assert.equal((await getAccountAccess(claimed.userId, claimed.version)).state, 'gone');
      assert.equal((await call('/auth/me', { token: player.token })).status, 401);
    }
  });

  await t.test('only the accounts named are touched', async () => {
    const a = await newPlayer();
    const bystander = await newPlayer();
    await revokeSessions(pool, { only: [a.id] });
    assert.equal((await call('/auth/me', { token: bystander.token })).status, 200);
  });

  await t.test('a player can sign in again afterwards and gets a working token', async () => {
    const a = await newPlayer();
    await revokeSessions(pool, { only: [a.id] });
    const res = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: a.email, password: 'password123' }) });
    assert.equal(res.status, 200);
    assert.equal((await call('/auth/me', { token: res.body.token })).status, 200);
  });

  await t.test('the links sent by email (password reset, account deletion) are gone too', async () => {
    const a = await newPlayer();
    const kept = await newPlayer();
    for (const p of [a, kept]) {
      await pool.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'reset', $2, now() + interval '1 hour')`, [p.id, `hash-${p.id}`]);
    }
    const report = await revokeSessions(pool, { only: [a.id] });
    assert.equal(report.emailLinks, 1);
    assert.equal((await pool.query('SELECT 1 FROM email_tokens WHERE user_id = $1', [a.id])).rows.length, 0);
    assert.equal((await pool.query('SELECT 1 FROM email_tokens WHERE user_id = $1', [kept.id])).rows.length, 1, 'a link for someone not named is left alone');
  });

  await t.test('it raises each account by one, and a token signed under the new number works', async () => {
    const a = await newPlayer();
    const before = await versionOf(a.id);
    const report = await revokeSessions(pool, { only: [a.id] });
    assert.equal(report.accounts, 1);
    assert.equal(await versionOf(a.id), before + 1);
    assert.equal((await call('/auth/me', { token: signAuthToken(a.id, before + 1) })).status, 200);
  });

  await t.test('with nobody named it reaches every account (inside a transaction that is rolled back, so no one else is signed out)', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const total = Number((await client.query('SELECT count(*) FROM users')).rows[0].count);
      const report = await revokeSessions(client);
      assert.equal(report.accounts, total);
      const { rows } = await client.query('SELECT id, token_version FROM users WHERE id = ANY($1::int[])', [[a.id, b.id]]);
      assert.equal(rows.length, 2);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    assert.equal((await call('/auth/me', { token: a.token })).status, 200, 'rolled back: nothing changed for anyone');
  });
});
