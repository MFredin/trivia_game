import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, newPlayer, skip } from './helpers/app.js';

// A read-only look at the things an attacker holding a signing secret or the database would have wanted to change: who can act as an admin or a moderator,
// and what they have done lately. It cannot prove nothing happened, but it shows an account that should not be there (docs/secret-rotation.md).
test('the exposure report', { skip }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);
  const { exposureReport } = await import('../src/services/exposureReport.js');

  await t.test('it lists every admin and moderator, and nobody else', async () => {
    const admin = await newPlayer();
    const mod = await newPlayer();
    const plain = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    await pool.query('UPDATE users SET is_moderator = true WHERE id = $1', [mod.id]);
    const report = await exposureReport(pool, { days: 30 });
    const roles = Object.fromEntries(report.privileged.map((p) => [p.id, p.role]));
    assert.equal(roles[admin.id], 'admin');
    assert.equal(roles[mod.id], 'moderator');
    assert.equal(roles[plain.id], undefined);
  });

  await t.test('it never carries an email address or a password hash', async () => {
    const admin = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    const text = JSON.stringify(await exposureReport(pool, { days: 30 }));
    assert.ok(!text.includes('@test.invalid'));
    assert.ok(!/password_hash|scrypt/i.test(text));
  });

  await t.test('it counts what moderators did in the window, by who did it', async () => {
    const admin = await newPlayer();
    const target = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    await pool.query(
      `INSERT INTO moderation_actions (batch_id, user_id, admin_id, action, note) VALUES (gen_random_uuid(), $1, $2, 'warn', 'a test')`,
      [target.id, admin.id],
    );
    const report = await exposureReport(pool, { days: 30 });
    const row = report.moderation.find((m) => m.adminId === admin.id);
    assert.equal(row.actions, 1);
    assert.equal(row.users, 1);
  });

  await t.test('accounts made in the window are counted, so a flood of new ones shows', async () => {
    await newPlayer();
    const report = await exposureReport(pool, { days: 1 });
    assert.ok(report.newAccounts >= 1);
  });
});
