import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';
import { evaluateAchievements } from '../src/services/achievements.js';

test('titles', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const admin = await newPlayer();
  await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);

  const unlock = (player, achievementId) =>
    pool.query('INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [player.id, achievementId]);
  const choose = (player, title) => call('/account/profile', { method: 'PATCH', token: player.token, body: json({ title }) });
  const customization = async (player) => (await call('/account/customization', { token: player.token })).body;
  const grant = (as, username, title) => call('/admin/titles', { method: 'POST', token: as.token, body: json({ username, title }) });
  const profileOf = async (viewer, player) => (await call(`/profile/${player.username}`, { token: viewer.token })).body;

  await t.test('the picker lists every earned title with whether it is held, and no system title that is not yours', async () => {
    const me = await newPlayer();
    const before = (await customization(me)).titles;
    const newcomer = before.find((x) => x.id === 'newcomer');
    assert.equal(newcomer.held, false);
    assert.equal(newcomer.kind, 'earned');
    assert.match(newcomer.requirement, /Complete your first run/, 'it says how to get it');
    assert.equal(before.some((x) => x.kind === 'system'), false, 'a title you cannot be given is not on offer');

    await unlock(me, 'milestone_1');
    assert.equal((await customization(me)).titles.find((x) => x.id === 'newcomer').held, true);
  });

  await t.test('a title is worn only if it is held, and clears with null', async () => {
    const me = await newPlayer();
    assert.equal((await choose(me, 'newcomer')).body.error, 'title_not_held');
    assert.equal((await choose(me, 'no-such-title')).body.error, 'invalid_title');
    assert.equal((await choose(me, 7)).body.error, 'invalid_title');
    assert.equal((await choose(me, 'prefect')).body.error, 'title_not_held', 'a system title is not self-service');

    await unlock(me, 'milestone_1');
    const worn = await choose(me, 'newcomer');
    assert.equal(worn.status, 200);
    assert.deepEqual(worn.body.user.title, { id: 'newcomer', name: 'Newcomer', kind: 'earned' });
    assert.equal((await call('/auth/me', { token: me.token })).body.user.title.name, 'Newcomer');

    assert.equal((await choose(me, null)).body.user.title, null);
  });

  await t.test('other players see it on the profile and in member lists', async () => {
    const me = await newPlayer();
    const viewer = await newPlayer();
    await unlock(me, 'milestone_10');
    await choose(me, 'reader');
    assert.equal((await profileOf(viewer, me)).title.name, 'Reader');
    const row = (await call(`/friends/search?q=${encodeURIComponent(me.username.slice(0, 8))}`, { token: viewer.token })).body.results.find(
      (r) => r.username === me.username,
    );
    assert.deepEqual(row.title, { id: 'reader', name: 'Reader', kind: 'earned' });
    assert.equal((await profileOf(viewer, viewer)).title, null);
  });

  await t.test('only an admin can grant a system title, and only to a real player', async () => {
    const player = await newPlayer();
    const other = await newPlayer();
    assert.equal((await grant(other, player.username, 'prefect')).status, 403, 'a player cannot grant');
    assert.equal((await call('/admin/titles', { token: other.token })).status, 403);
    assert.equal((await call('/admin/titles', { method: 'POST', body: json({}) })).status, 401);

    assert.equal((await grant(admin, 'nobody-by-this-name', 'prefect')).status, 404);
    assert.equal((await grant(admin, player.username, 'newcomer')).body.error, 'not_a_system_title', 'an earned title cannot be given');
    assert.equal((await grant(admin, player.username, 'wizard-king')).body.error, 'invalid_title');
    assert.equal((await grant(admin, admin.username, 'head_student')).status, 201, 'an admin may hold one themselves');
  });

  await t.test('a granted title shows up in the picker, can be worn, and revoking takes it off them', async () => {
    const player = await newPlayer();
    assert.equal((await grant(admin, player.username, 'prefect')).status, 201);
    assert.equal((await grant(admin, player.username, 'prefect')).status, 200, 'granting twice is not an error');

    const offered = (await customization(player)).titles.find((x) => x.id === 'prefect');
    assert.equal(offered.held, true);
    assert.equal(offered.kind, 'system');
    assert.equal((await choose(player, 'prefect')).body.user.title.name, 'Prefect');

    const holders = (await call('/admin/titles', { token: admin.token })).body.holders;
    const mine = holders.find((h) => h.username === player.username && h.title === 'prefect');
    assert.equal(mine.granted_by, admin.username);

    assert.equal((await call(`/admin/titles/${player.username}/prefect`, { method: 'DELETE', token: admin.token })).status, 204);
    assert.equal((await call('/auth/me', { token: player.token })).body.user.title, null, 'and it stops being worn at once');
    assert.equal((await choose(player, 'prefect')).body.error, 'title_not_held');
    assert.equal((await call(`/admin/titles/${player.username}/prefect`, { method: 'DELETE', token: admin.token })).status, 404, 'nothing left to revoke');
  });

  await t.test('deleting the account takes the title and the grants with it', async () => {
    const player = await newPlayer();
    await grant(admin, player.username, 'librarian');
    await choose(player, 'librarian');
    await call('/account', { method: 'DELETE', token: player.token, body: json({ password: 'password123' }) });
    const { rows } = await pool.query('SELECT title FROM users WHERE id = $1', [player.id]);
    assert.equal(rows[0].title, null);
    assert.equal((await pool.query('SELECT 1 FROM user_titles WHERE user_id = $1', [player.id])).rowCount, 0);
  });

  await t.test('a question the admin approved unlocks the contributor badge, counted by the stats', async () => {
    const author = await newPlayer();
    await pool.query(
      `INSERT INTO suggested_questions (suggested_by, status, category, question_text, correct_answer, distractors)
       VALUES ($1, 'approved', 'Spells', 'Which charm makes things float?', 'Wingardium Leviosa', ARRAY['a','b','c'])`,
      [author.id],
    );
    const unlocked = (await evaluateAchievements(author.id)).map((a) => a.id);
    assert.ok(unlocked.includes('contrib_question_1'));
    assert.equal(unlocked.includes('contrib_question_5'), false);
    assert.equal((await customization(author)).titles.find((x) => x.id === 'contributor').held, true, 'and with it the title');
  });
});
