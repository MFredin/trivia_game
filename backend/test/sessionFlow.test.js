import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/**
 * The answer flow, end to end against a real database.
 *
 * Everything else under test/ is a pure function. That left the part of the app that has
 * actually broken — a run that could not be finished, and session routes that took the run's
 * id as their only credential — covered by nothing. Both were found by playing the game.
 *
 * Skipped when DATABASE_URL is unset, so `npm test` still works on a machine with no
 * Postgres. dotenv first, so a local backend/.env counts — otherwise these would quietly
 * skip on exactly the machine they were written on.
 */
const SKIP = !process.env.DATABASE_URL;

let server;
let base;
let pool;

async function boot() {
  const { createApp } = await import('../src/app.js');
  ({ pool } = await import('../src/db/pool.js'));
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}

const call = async (path, { token, ...options } = {}) => {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

async function newPlayer() {
  // Registration is rate limited per IP, and every test here shares one. Going through the
  // database directly keeps the limiter out of the way of tests that are not about it.
  const { hashPassword } = await import('../src/lib/passwords.js');
  const { signAuthToken } = await import('../src/lib/authTokens.js');
  const name = `t${Math.random().toString(36).slice(2, 10)}`;
  const { rows } = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [name, `${name}@test.invalid`, hashPassword('password123')],
  );
  return { id: rows[0].id, username: name, token: signAuthToken(rows[0].id) };
}

test('session routes', { skip: SKIP && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  const owner = await newPlayer();
  const stranger = await newPlayer();

  const created = await call('/sessions', {
    method: 'POST',
    token: owner.token,
    body: JSON.stringify({ mode: 'classic' }),
  });
  assert.equal(created.status, 201);
  const sessionId = created.body.session_id;

  await t.test('a run is private to the player who started it', async () => {
    for (const [method, path, body] of [
      ['GET', `/sessions/${sessionId}`, undefined],
      ['POST', `/sessions/${sessionId}/next`, '{}'],
      ['POST', `/sessions/${sessionId}/answer`, '{"question_id":"x","chosen_index":0,"token":"y"}'],
      ['POST', `/sessions/${sessionId}/lifeline`, '{"question_id":"x","token":"y","type":"fifty_fifty"}'],
    ]) {
      assert.equal((await call(path, { method, body })).status, 401, `${method} ${path} without a token`);
      // 404 rather than 403: the endpoint must not double as a way to test whether an id exists.
      assert.equal(
        (await call(path, { method, body, token: stranger.token })).status,
        404,
        `${method} ${path} as another player`,
      );
    }
  });

  await t.test('a run can be played to the end', async () => {
    let question = created.body.question;
    let token = created.body.token;
    let answered = 0;
    let complete = false;

    while (!complete && answered < 20) {
      const answer = await call(`/sessions/${sessionId}/answer`, {
        method: 'POST',
        token: owner.token,
        body: JSON.stringify({ question_id: question.question_id, chosen_index: 0, token }),
      });
      assert.equal(answer.status, 200);
      answered += 1;
      complete = answer.body.session_complete;
      if (complete) break;

      const next = await call(`/sessions/${sessionId}/next`, { method: 'POST', token: owner.token });
      assert.equal(next.status, 200, 'the next question is served');
      question = next.question ?? next.body.question;
      token = next.body.token;
    }

    // The bug this test exists for: the run stalled on the last question and never reported
    // itself finished, so the summary never arrived.
    assert.equal(answered, 10, 'every question in the run was answerable');
    assert.equal(complete, true, 'the run reported itself complete');
    assert.equal((await call(`/sessions/${sessionId}`, { token: owner.token })).body.status, 'completed');
  });

  await t.test('/next is idempotent, so a retry cannot buy more time', async () => {
    const other = await newPlayer();
    const run = await call('/sessions', {
      method: 'POST',
      token: other.token,
      body: JSON.stringify({ mode: 'classic' }),
    });
    const id = run.body.session_id;
    await call(`/sessions/${id}/answer`, {
      method: 'POST',
      token: other.token,
      body: JSON.stringify({
        question_id: run.body.question.question_id,
        chosen_index: 0,
        token: run.body.token,
      }),
    });
    const first = await call(`/sessions/${id}/next`, { method: 'POST', token: other.token });
    const second = await call(`/sessions/${id}/next`, { method: 'POST', token: other.token });
    assert.equal(first.body.question.question_id, second.body.question.question_id);
    assert.equal(first.body.issued_at, second.body.issued_at, 'the clock did not restart');
  });
});
