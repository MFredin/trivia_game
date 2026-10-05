import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/**
 * Phase 2 anti-cheat (docs/anti-cheat-architecture.md), end to end against a real database:
 * a completed run matching the anomaly heuristic gets shadow-flagged, disappears from the
 * PUBLIC leaderboard, but still shows up in the run owner's own session data.
 *
 * Follows the same real-database, skip-when-no-DATABASE_URL convention as sessionFlow.test.js.
 * Rows are written directly rather than played through the HTTP answer flow, because
 * runPostAnswerBookkeeping (where the flag is computed) runs AFTER the answer response is
 * already sent — asserting on it through the HTTP route would be racing that background work.
 * Calling it directly, the way routes/sessions.js does, tests the real code path without the
 * race.
 */
const SKIP = !process.env.DATABASE_URL;

let server;
let base;
let pool;
let runPostAnswerBookkeeping;

async function boot() {
  const { createApp } = await import('../src/app.js');
  ({ pool } = await import('../src/db/pool.js'));
  ({ runPostAnswerBookkeeping } = await import('../src/services/answerFlow.js'));
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
  const { hashPassword } = await import('../src/lib/passwords.js');
  const { signAuthToken } = await import('../src/lib/authTokens.js');
  const name = `anom${Math.random().toString(36).slice(2, 10)}`;
  const { rows } = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [name, `${name}@test.invalid`, hashPassword('password123')],
  );
  return { id: rows[0].id, username: name, token: signAuthToken(rows[0].id) };
}

// 10 real N.E.W.T.-tier question ids from the seeded starter bank — any run filtered to this
// tier draws only from questions like these, so a real "difficulty: N.E.W.T." run looks exactly
// like this fixture.
const NEWT_QUESTION_IDS = [
  'CHR-005', 'CHR-006', 'CHR-010', 'DIV-002', 'DIV-003',
  'DIV-004', 'DIV-006', 'DIV-007', 'DIV-008', 'DIV-009',
];

const TIME_LIMIT_MS = 20000;

async function insertCompletedSession({ userId, totalScore, difficulty, elapsedMsByPosition }) {
  const { currentLeaderboardWindow } = await import('../src/lib/leaderboardWindow.js');
  const { rows } = await pool.query(
    `INSERT INTO game_sessions
       (user_id, mode, category, canon_source, obscurity_filter, question_count, time_limit_ms,
        status, total_score, best_streak, streak, leaderboard_window, completed_at)
     VALUES ($1, 'classic', NULL, 'combined', $2, 10, $3, 'completed', $4, 10, 10, $5, now())
     RETURNING *`,
    [userId, difficulty, TIME_LIMIT_MS, totalScore, currentLeaderboardWindow()],
  );
  const session = rows[0];

  for (let position = 0; position < NEWT_QUESTION_IDS.length; position++) {
    await pool.query(
      `INSERT INTO session_questions
         (session_id, position, question_id, choice_order, correct_choice_index,
          answered_at, chosen_index, correct, timed_out, points, elapsed_ms)
       VALUES ($1, $2, $3, '{0,1,2,3}', 0, now(), 0, true, false, $4, $5)`,
      [session.id, position, NEWT_QUESTION_IDS[position], 200, elapsedMsByPosition[position]],
    );
  }

  return session;
}

test('anomaly shadow-flagging', { skip: SKIP && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  const cheater = await newPlayer();
  const legitimate = await newPlayer();

  await t.test('a run with perfect accuracy, hardest tier, and near-minimum times gets flagged', async () => {
    const elapsedMsByPosition = NEWT_QUESTION_IDS.map(() => 400); // 2% of the 20s clock, every time.
    const session = await insertCompletedSession({
      userId: cheater.id,
      totalScore: 5000,
      difficulty: 'N.E.W.T.',
      elapsedMsByPosition,
    });

    await runPostAnswerBookkeeping({
      session,
      outcome: { correct: true, points: 200, newTotalScore: 5000, streakAfter: 10, sessionComplete: true },
    });

    const { rows } = await pool.query('SELECT flagged_for_review, flag_reason FROM game_sessions WHERE id = $1', [
      session.id,
    ]);
    assert.equal(rows[0].flagged_for_review, true);
    assert.match(rows[0].flag_reason, /perfect_accuracy_hard_tier_near_min_time/);
  });

  await t.test('a fast-but-plausible run at the same tier is NOT flagged', async () => {
    // Perfect accuracy, same hard tier, but genuinely a few seconds per question rather than
    // a near-instant tap every time — the false positive this heuristic must not produce.
    const elapsedMsByPosition = [4000, 6000, 5000, 7000, 4500, 6500, 5000, 8000, 4000, 7000];
    const session = await insertCompletedSession({
      userId: legitimate.id,
      totalScore: 4800,
      difficulty: 'N.E.W.T.',
      elapsedMsByPosition,
    });

    await runPostAnswerBookkeeping({
      session,
      outcome: { correct: true, points: 200, newTotalScore: 4800, streakAfter: 10, sessionComplete: true },
    });

    const { rows } = await pool.query('SELECT flagged_for_review, flag_reason FROM game_sessions WHERE id = $1', [
      session.id,
    ]);
    assert.equal(rows[0].flagged_for_review, false);
    assert.equal(rows[0].flag_reason, null);
  });

  await t.test('the flagged run is excluded from the public leaderboard, the clean one is not', async () => {
    const board = await call('/leaderboard?mode=classic&difficulty=N.E.W.T.&window=current&limit=100');
    assert.equal(board.status, 200);
    const usernames = board.body.entries.map((e) => e.username);
    assert.equal(usernames.includes(cheater.username), false, 'the flagged run must not appear publicly');
    assert.equal(usernames.includes(legitimate.username), true, 'a clean run must still appear publicly');
  });

  await t.test("the flagged run still shows up in its own owner's session data", async () => {
    const { rows } = await pool.query('SELECT id FROM game_sessions WHERE user_id = $1', [cheater.id]);
    const sessionId = rows[0].id;
    const res = await call(`/sessions/${sessionId}`, { token: cheater.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'completed');
    assert.equal(res.body.total_score, 5000);
  });
});
