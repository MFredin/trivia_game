import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';

// These routes are throttled per address in production; this file makes many requests from one.
process.env.RECOVERY_RATE_LIMIT_MAX = '1000';

import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';
import { chooseProvider, clearOutbox, outbox } from '../src/lib/mailer.js';

test('which way mail is sent', async (t) => {
  await t.test('a configured provider is used; without one, development logs and production sends nothing', () => {
    assert.equal(chooseProvider({ RESEND_API_KEY: 'k', MAIL_FROM: 'a@b.co', NODE_ENV: 'production' }), 'resend');
    assert.equal(chooseProvider({ NODE_ENV: 'development' }), 'log');
    assert.equal(chooseProvider({}), 'log');
    assert.equal(chooseProvider({ NODE_ENV: 'production' }), null, 'in production nothing is faked');
    assert.equal(chooseProvider({ RESEND_API_KEY: 'k', NODE_ENV: 'production' }), null, 'a key without a sender is not enough');
  });
});

test('password reset and account deletion by email', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const post = (path, body) => call(path, { method: 'POST', body: json(body) });
  const lastMail = () => outbox.at(-1);
  const tokenFrom = (mail, param) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get(param);
  const mailTo = (email) => outbox.filter((m) => m.to === email);

  await t.test('the app says whether it can send mail, so a screen does not promise what it cannot do', async () => {
    assert.equal((await call('/auth/options')).body.mail_enabled, true);
  });

  await t.test('asking for a reset answers the same whether or not the address has an account', async () => {
    clearOutbox();
    const player = await newPlayer();
    const known = await post('/auth/password-reset/request', { email: player.email });
    const unknown = await post('/auth/password-reset/request', { email: 'no-one-here@test.invalid' });
    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body, 'nothing to tell the two apart');
    assert.equal(mailTo(player.email).length, 1);
    assert.equal(mailTo('no-one-here@test.invalid').length, 0);
    assert.equal((await post('/auth/password-reset/request', { email: 7 })).status, 400);
    assert.match(lastMail().text, /If you did not ask/i, 'and says what to do if it was not them');
  });

  await t.test('the link sets a new password once, and the old one stops working', async () => {
    clearOutbox();
    const player = await newPlayer();
    await post('/auth/password-reset/request', { email: player.email });
    const token = tokenFrom(lastMail(), 'reset');

    assert.equal((await post('/auth/password-reset/confirm', { token, password: 'short' })).body.error, 'password_too_short');
    assert.equal((await post('/auth/password-reset/confirm', { token: 'not-a-token', password: 'a-new-password' })).body.error, 'invalid_token');

    assert.equal((await post('/auth/password-reset/confirm', { token, password: 'a-new-password' })).status, 204, 'a refused attempt did not use the token up');
    assert.equal((await post('/auth/login', { email: player.email, password: 'a-new-password' })).status, 200);
    assert.equal((await post('/auth/login', { email: player.email, password: 'password123' })).status, 401);
    assert.equal((await post('/auth/password-reset/confirm', { token, password: 'another-password' })).body.error, 'invalid_token', 'once only');
  });

  await t.test('only a hash of the token is stored, it expires, and a new request replaces the old', async () => {
    clearOutbox();
    const player = await newPlayer();
    await post('/auth/password-reset/request', { email: player.email });
    const first = tokenFrom(lastMail(), 'reset');
    const { rows } = await pool.query('SELECT token_hash FROM email_tokens WHERE user_id = $1', [player.id]);
    assert.equal(rows.length, 1);
    assert.ok(!rows[0].token_hash.includes(first), 'the token itself is not kept');

    await post('/auth/password-reset/request', { email: player.email });
    const second = tokenFrom(lastMail(), 'reset');
    assert.notEqual(first, second);
    assert.equal((await post('/auth/password-reset/confirm', { token: first, password: 'a-new-password' })).body.error, 'invalid_token', 'the earlier link is dead');

    await pool.query(`UPDATE email_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1`, [player.id]);
    assert.equal((await post('/auth/password-reset/confirm', { token: second, password: 'a-new-password' })).body.error, 'invalid_token', 'and an old one');
  });

  await t.test('no more than three a day are sent to one address, and the answer does not change', async () => {
    clearOutbox();
    const player = await newPlayer();
    const answers = [];
    for (let i = 0; i < 5; i += 1) answers.push((await post('/auth/password-reset/request', { email: player.email })).status);
    assert.deepEqual(answers, [200, 200, 200, 200, 200]);
    assert.equal(mailTo(player.email).length, 3);
  });

  await t.test('a deleted account has no address to send to', async () => {
    clearOutbox();
    const gone = await newPlayer();
    await pool.query('UPDATE users SET email = NULL, deleted_at = now() WHERE id = $1', [gone.id]);
    await post('/auth/password-reset/request', { email: gone.email });
    assert.equal(mailTo(gone.email).length, 0);
  });

  await t.test('a deletion link shows whose account it is, and deletes it only when confirmed', async () => {
    clearOutbox();
    const player = await newPlayer();
    assert.equal((await post('/auth/account-deletion/request', { email: player.email })).status, 200);
    const token = tokenFrom(lastMail(), 'delete');

    const preview = await call(`/auth/account-deletion/preview?token=${encodeURIComponent(token)}`);
    assert.equal(preview.body.username, player.username);
    assert.equal((await pool.query('SELECT deleted_at FROM users WHERE id = $1', [player.id])).rows[0].deleted_at, null, 'looking is not deleting');
    assert.equal((await call('/auth/account-deletion/preview?token=nope')).status, 400);

    assert.equal((await post('/auth/account-deletion/confirm', { token })).status, 204);
    const { rows } = await pool.query('SELECT deleted_at, email FROM users WHERE id = $1', [player.id]);
    assert.ok(rows[0].deleted_at);
    assert.equal(rows[0].email, null);
    assert.equal((await post('/auth/account-deletion/confirm', { token })).body.error, 'invalid_token', 'once only');
  });

  await t.test('a link for one thing does not work for the other', async () => {
    clearOutbox();
    const player = await newPlayer();
    await post('/auth/account-deletion/request', { email: player.email });
    const deleteToken = tokenFrom(lastMail(), 'delete');
    assert.equal((await post('/auth/password-reset/confirm', { token: deleteToken, password: 'a-new-password' })).body.error, 'invalid_token');

    await post('/auth/password-reset/request', { email: player.email });
    const resetToken = tokenFrom(lastMail(), 'reset');
    assert.equal((await post('/auth/account-deletion/confirm', { token: resetToken })).body.error, 'invalid_token');
    assert.equal((await pool.query('SELECT deleted_at FROM users WHERE id = $1', [player.id])).rows[0].deleted_at, null);
  });
});
