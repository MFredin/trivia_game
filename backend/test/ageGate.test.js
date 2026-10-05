import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, skip } from './helpers/app.js';
import { MINIMUM_AGE, checkBirthDate, isOldEnough } from '../src/lib/ageGate.js';

const NOW = new Date('2026-10-15T12:00:00Z');

test('the age rule', async (t) => {
  await t.test('the minimum is thirteen', () => assert.equal(MINIMUM_AGE, 13));

  await t.test('counts only whole months, so a player is never let in a day early', () => {
    // Born September 2013: thirteen during September 2026, so only from October is it certain.
    assert.equal(isOldEnough({ month: 9, year: 2013 }, NOW), true);
    // Born October 2013: thirteen at some point this month, which is not yet certain.
    assert.equal(isOldEnough({ month: 10, year: 2013 }, NOW), false);
    assert.equal(isOldEnough({ month: 11, year: 2013 }, NOW), false);
    assert.equal(isOldEnough({ month: 1, year: 2014 }, NOW), false);
    assert.equal(isOldEnough({ month: 1, year: 1990 }, NOW), true);
  });

  await t.test('a birth date has to be a real month of a plausible year', () => {
    assert.deepEqual(checkBirthDate({ month: 3, year: 2000 }, NOW), { ok: true, month: 3, year: 2000 });
    for (const bad of [
      {},
      { month: 0, year: 2000 },
      { month: 13, year: 2000 },
      { month: 3 },
      { year: 2000 },
      { month: '3', year: 2000 },
      { month: 3.5, year: 2000 },
      { month: 3, year: 1899 },
      { month: 3, year: 2027 },
      null,
      'March 2000',
    ]) {
      assert.deepEqual(checkBirthDate(bad, NOW), { ok: false }, JSON.stringify(bad));
    }
  });
});

test('registration asks for age first and keeps nothing from anyone under it', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const register = (extra = {}, email = `${Math.random().toString(36).slice(2)}@test.invalid`) =>
    call('/auth/register', {
      method: 'POST',
      body: json({ email, username: `g${Math.random().toString(36).slice(2, 9)}`, password: 'password123', ...extra }),
    });
  const thisYear = new Date().getUTCFullYear();

  await t.test('no birth date, or a nonsense one, is refused before anything is read', async () => {
    assert.equal((await register()).body.error, 'invalid_birth_date');
    assert.equal((await register({ birth_month: 13, birth_year: 1990 })).body.error, 'invalid_birth_date');
    assert.equal((await register({ birth_month: '5', birth_year: 1990 })).body.error, 'invalid_birth_date');
  });

  await t.test('someone under thirteen is refused, and no account, email or name is kept', async () => {
    const email = `child${Math.random().toString(36).slice(2)}@test.invalid`;
    const username = `kid${Math.random().toString(36).slice(2, 8)}`;
    const res = await call('/auth/register', {
      method: 'POST',
      body: json({ email, username, password: 'password123', birth_month: 1, birth_year: thisYear - 10 }),
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'underage');
    assert.equal(res.body.minimum_age, 13);
    assert.equal((await pool.query('SELECT 1 FROM users WHERE email = $1 OR username = $2', [email, username])).rowCount, 0);
  });

  await t.test('and the age is checked before the rest, so an invalid email does not get a child further', async () => {
    const res = await call('/auth/register', {
      method: 'POST',
      body: json({ email: 'not-an-email', username: 'x', password: 'short', birth_month: 1, birth_year: thisYear - 5 }),
    });
    assert.equal(res.body.error, 'underage');
  });

  await t.test('an adult registers as before, and the account notes that the age check was passed, not the date', async () => {
    const email = `adult${Math.random().toString(36).slice(2)}@test.invalid`;
    const res = await register({ birth_month: 6, birth_year: thisYear - 30 }, email);
    assert.equal(res.status, 201);
    const { rows } = await pool.query('SELECT age_confirmed_at FROM users WHERE email = $1', [email]);
    assert.ok(rows[0].age_confirmed_at, 'when it was confirmed');
    const { rows: cols } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%birth%'`,
    );
    assert.equal(cols.length, 0, 'the birth date itself is not stored anywhere');
  });
});
