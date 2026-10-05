import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, befriend, skip } from './helpers/app.js';

// One boot for the file: the database pool is a module singleton, so a second boot/shutdown pair
// in the same process would be handed a pool the first had already closed.
test('profile fields', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  await t.test('bio, favourites and pinned achievements', async (t) => {
    const me = await newPlayer();
    const viewer = await newPlayer();
    const save = (body, as = me) => call('/account/profile', { method: 'PATCH', token: as.token, body: json(body) });
    const profile = (name = me.username, as = viewer) => call(`/profile/${name}`, { token: as.token });
    const earn = (id, at) =>
      pool.query('INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3)', [me.id, id, at]);

    await t.test('a bio is saved, shown to other players, and cleared by an empty one', async () => {
      const res = await save({ bio: '  Ravenclaw   since 2001.  ' });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.bio, 'Ravenclaw since 2001.');
      assert.equal((await profile()).body.bio, 'Ravenclaw since 2001.');

      assert.equal((await save({ bio: '' })).body.user.bio, null);
      assert.equal((await profile()).body.bio, null);
  });

  await t.test('a bio that fails the filter is refused with the reason, and nothing else in the request is saved', async () => {
    for (const [bio, error] of [
      ['x'.repeat(141), 'bio_too_long'],
      ['write to me@example.com', 'bio_has_link'],
      ['visit www.example.org', 'bio_has_link'],
      [3, 'invalid_bio'],
    ]) {
      const res = await save({ bio, avatar: 'quill' });
      assert.equal(res.status, 400, JSON.stringify(bio));
      assert.equal(res.body.error, error);
    }
    assert.equal((await call('/auth/me', { token: me.token })).body.user.avatar, null);
  });

  await t.test('only fields that exist can be sent', async () => {
    const res = await save({ is_admin: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'unknown_field');
  });

  await t.test('a favourite book and a favourite subject come from the lists, or are cleared', async () => {
    const info = (await call('/account/customization', { token: me.token })).body;
    assert.equal(info.books.length, 7);
    assert.ok(info.subjects.length > 0);
    assert.equal(info.limits.bio, 140);

    const res = await save({ favorite_book: info.books[2], favorite_subject: info.subjects[0] });
    assert.equal(res.status, 200);
    const seen = (await profile()).body;
    assert.equal(seen.favorite_book, info.books[2]);
    assert.equal(seen.favorite_subject, info.subjects[0]);

    assert.equal((await save({ favorite_book: 'The Hobbit' })).status, 400);
    assert.equal((await save({ favorite_subject: 'Not a category' })).status, 400);
    assert.equal((await save({ favorite_book: null, favorite_subject: null })).status, 200);
  });

  await t.test('pinned achievements must be earned, at most three, no repeats — and replace the recent list on the profile', async () => {
    await earn('milestone_1', '2026-01-01');
    await earn('streak_10', '2026-02-01');
    await earn('social_friend', '2026-03-01');
    await earn('milestone_10', '2026-04-01');

    assert.equal((await save({ pinned_achievements: ['mastery_flawless'] })).body.error, 'achievement_not_earned');
    assert.equal((await save({ pinned_achievements: ['milestone_1', 'milestone_1'] })).status, 400);
    assert.equal((await save({ pinned_achievements: ['milestone_1', 'streak_10', 'social_friend', 'milestone_10'] })).status, 400);

    const before = (await profile()).body;
    assert.equal(before.achievements_pinned, false);
    assert.equal(before.achievements_showcase[0].id, 'milestone_10', 'most recent first by default');

    assert.equal((await save({ pinned_achievements: ['streak_10', 'milestone_1'] })).status, 200);
    const after = (await profile()).body;
    assert.equal(after.achievements_pinned, true);
    assert.deepEqual(after.achievements_showcase.map((a) => a.id), ['streak_10', 'milestone_1'], 'in the order chosen');

    await save({ pinned_achievements: [] });
    assert.equal((await profile()).body.achievements_pinned, false);
  });

  await t.test('is hidden from anyone who is blocked, like the rest of the profile', async () => {
    await save({ bio: 'Hello there' });
    await call('/blocks', { method: 'POST', token: me.token, body: json({ username: viewer.username }) });
    assert.equal((await profile()).status, 404);
    await call(`/blocks/${viewer.username}`, { method: 'DELETE', token: me.token });
  });

  await t.test('is removed when the account is deleted', async () => {
    const leaver = await newPlayer();
    await save({ bio: 'about to go', avatar: 'moon', avatar_style: { shape: 'octagon' }, favorite_book: 'Goblet of Fire' }, leaver);
    await pool.query(`UPDATE users SET pinned_achievements = ARRAY['milestone_1'] WHERE id = $1`, [leaver.id]);
    await call('/account', { method: 'DELETE', token: leaver.token, body: json({ password: 'password123' }) });

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [leaver.id]);
    assert.equal(rows[0].bio, null);
    assert.equal(rows[0].favorite_book, null);
    assert.deepEqual(rows[0].avatar_style, {});
    assert.deepEqual(rows[0].pinned_achievements, []);
  });
  });

  await t.test('reporting a bio', async (t) => {
    const admin = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);
    const author = await newPlayer();
    const reporter = await newPlayer();
    await call('/account/profile', { method: 'PATCH', token: author.token, body: json({ bio: 'a bio worth reporting' }) });

    const report = () =>
      call('/reports', { method: 'POST', token: reporter.token, body: json({ username: author.username, reason: 'offensive_bio' }) });
    const queueEntry = async () =>
      (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === author.username);
    const bioOf = async () => (await pool.query('SELECT bio FROM users WHERE id = $1', [author.id])).rows[0].bio;

    await t.test('arrives in the queue with the bio the moderator will be judging', async () => {
      assert.equal((await report()).status, 201);
      const entry = await queueEntry();
      assert.equal(entry.reason, 'offensive_bio');
      assert.equal(entry.reported_bio, 'a bio worth reporting');
    });

    await t.test('dismissing it never touches the bio', async () => {
      const entry = await queueEntry();
      const res = await call(`/reports/${entry.id}/resolve`, { method: 'POST', token: admin.token, body: json({ outcome: 'dismissed' }) });
      assert.equal(res.status, 204);
      assert.equal(await bioOf(), 'a bio worth reporting');
    });

    await t.test('taking the clear_bio action removes it, and tells the player why', async () => {
      await report();
      const entry = await queueEntry();
      const res = await call(`/reports/${entry.id}/action`, {
        method: 'POST',
        token: admin.token,
        body: json({ actions: ['clear_bio', 'warn'], note: 'Your bio broke the house rules, so it was removed.' }),
      });
      assert.equal(res.status, 200);
      assert.equal(await bioOf(), null);
      const notices = (await call('/moderation/notices', { token: author.token })).body.notices;
      assert.deepEqual(notices[0].actions, ['clear_bio', 'warn']);
    });
  });
});
