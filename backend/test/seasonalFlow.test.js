import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, newPlayer, skip } from './helpers/app.js';
import { activeSeason, seasonKey, MIN_SEASON_POOL } from '../src/lib/seasons.js';

// The seasonal run end to end: the route creates a system challenge on first request, a second request returns the same
// one, and every player who starts it is dealt the same questions, drawn only from the season's tagged ones.
//
// It uses the real tagged bank rather than inserting questions of its own. Test files run in parallel against one
// database, so a question inserted here would be dealt into other files' runs and could not be deleted afterwards. The
// CI backend job therefore seeds the full bank; locally, `SEED_FILE=question-bank-full-draft.json npm run db:seed`.
test('a season is a shared, themed system challenge', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  const { invalidateQuestionCache } = await import('../src/repo/questions.js');

  const { rows: tagged } = await pool.query(`SELECT count(*)::int AS n FROM questions WHERE 'halloween' = ANY(themes)`);
  if (tagged[0].n < MIN_SEASON_POOL) {
    await shutdown();
    return t.skip(`only ${tagged[0].n} halloween questions are seeded; seed the full bank`);
  }
  invalidateQuestionCache();

  const key = seasonKey({ key: 'halloween', start: [10, 17], end: [11, 2] }, new Date());
  const alreadyThere = (await pool.query('SELECT 1 FROM challenges WHERE season_key = $1', [key])).rowCount > 0;
  const [a, b] = [await newPlayer(), await newPlayer()];

  t.after(async () => {
    // Remove what this test made, in dependency order, and leave a pre-existing season row alone.
    const sessions = (await pool.query('SELECT id FROM game_sessions WHERE user_id = ANY($1)', [[a.id, b.id]])).rows.map((r) => r.id);
    await pool.query('DELETE FROM session_questions WHERE session_id = ANY($1)', [sessions]);
    await pool.query('DELETE FROM game_sessions WHERE id = ANY($1)', [sessions]);
    if (!alreadyThere) await pool.query('DELETE FROM challenges WHERE season_key = $1', [key]);
    await shutdown();
  });

  await t.test('between seasons there is no season', { skip: activeSeason(new Date()) ? 'a real season is running today' : false }, async () => {
    const res = await call('/challenges/season');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { season: null });
  });

  let code;
  await t.test('a forced season is created on first request and is the same on the second', async () => {
    const first = await call('/challenges/season?force=halloween');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.season.key, key);
    assert.equal(first.body.season.label, 'The Halloween Feast');
    assert.equal(first.body.season.players, 0);
    code = first.body.season.code;

    const second = await call('/challenges/season?force=halloween');
    assert.equal(second.body.season.code, code, 'a second request must not make a second challenge');
  });

  await t.test('the override is ignored in production, so players can never be switched into a season', async (t2) => {
    if (activeSeason(new Date())) return t2.skip('a real season is running today');
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await call('/challenges/season?force=halloween');
      assert.deepEqual(res.body, { season: null });
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  await t.test('the challenge screen is told which season it is', async () => {
    const res = await call(`/challenges/${code}`, { token: a.token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.season, { key, label: 'The Halloween Feast', year: Number(key.split('-')[1]) });
    assert.equal(res.body.created_by_username, null);
    assert.deepEqual(res.body.leaderboard, []);
  });

  await t.test('every player is dealt the same question, and it is a seasonal one', async () => {
    const [runA, runB] = [
      await call(`/challenges/${code}/start`, { method: 'POST', token: a.token }),
      await call(`/challenges/${code}/start`, { method: 'POST', token: b.token }),
    ];
    assert.equal(runA.status, 201, JSON.stringify(runA.body));
    assert.equal(runA.body.question.question_id, runB.body.question.question_id, 'the same set for everyone');
    const { rows } = await pool.query('SELECT themes FROM questions WHERE id = $1', [runA.body.question.question_id]);
    assert.ok(rows[0].themes.includes('halloween'), 'a seasonal run drew an untagged question');
  });

  await t.test('a run is a challenge-mode run, so it stays off the Classic leaderboard', async () => {
    const { rows } = await pool.query(`SELECT mode, theme FROM game_sessions WHERE user_id = $1`, [a.id]);
    assert.deepEqual(rows, [{ mode: 'challenge', theme: 'halloween' }]);
  });
});
