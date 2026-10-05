import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';

const NOTE = 'Please keep it friendly: we are asking you to change how you write to other players.';

test('the moderator tier', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const staff = async (flag) => {
    const p = await newPlayer();
    await pool.query(`UPDATE users SET ${flag} = true WHERE id = $1`, [p.id]);
    return p;
  };
  const admin = await staff('is_admin');
  const mod = await staff('is_moderator');
  const mod2 = await staff('is_moderator');

  const reportAgainst = async (target, reason = 'harassment') => {
    const reporter = await newPlayer();
    await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: target.username, reason }) });
    return (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === target.username);
  };
  const act = (as, report, body) => call(`/reports/${report.id}/action`, { method: 'POST', token: as.token, body: json(body) });
  const queueFor = async (as) => (await call('/reports', { token: as.token })).body;
  const stateOf = async (p) => (await pool.query('SELECT suspended_until, banned_at, muted_until FROM users WHERE id = $1', [p.id])).rows[0];

  await t.test('players are kept out of the staff screens, and staff say what they are', async () => {
    const player = await newPlayer();
    assert.equal((await call('/reports', { token: player.token })).status, 403);
    assert.equal((await call('/moderation/actions', { token: player.token })).status, 403);
    assert.equal((await call('/auth/me', { token: player.token })).body.user.role, 'player');
    const m = (await call('/auth/me', { token: mod.token })).body.user;
    assert.equal(m.role, 'moderator');
    assert.equal(m.is_moderator, true);
    assert.equal((await call('/auth/me', { token: admin.token })).body.user.role, 'admin');
  });

  await t.test('a moderator reviews reports, offered what a moderator may do', async () => {
    const target = await newPlayer();
    await reportAgainst(target);
    const { reports, suspension_days: days, viewer_role: role } = await queueFor(mod);
    const mine = reports.find((r) => r.reported_username === target.username);
    assert.equal(role, 'moderator');
    assert.deepEqual(days, [1, 7]);
    assert.equal(mine.available_actions.includes('ban'), false);
    assert.equal(mine.available_actions.includes('suspend'), true);
    assert.equal((await queueFor(admin)).viewer_role, 'admin');
    assert.deepEqual((await queueFor(admin)).suspension_days, [1, 7, 30]);
  });

  await t.test('a moderator can warn and suspend for a week, but not ban or suspend for longer', async () => {
    const target = await newPlayer();
    const report = await reportAgainst(target);

    for (const body of [
      { actions: ['ban'], note: NOTE },
      { actions: ['suspend'], days: 30, note: NOTE },
      { actions: ['warn', 'mute'], days: 30, note: NOTE },
    ]) {
      const refused = await act(mod, report, body);
      assert.equal(refused.status, 403, JSON.stringify(body));
      assert.equal(refused.body.error, 'needs_admin');
    }
    const untouched = await stateOf(target);
    assert.equal(untouched.banned_at, null);
    assert.equal(untouched.suspended_until, null);
    assert.equal((await queueFor(admin)).reports.some((r) => r.id === report.id), true, 'the report is still open');

    const ok = await act(mod, report, { actions: ['warn', 'suspend'], days: 7, note: NOTE });
    assert.equal(ok.status, 200);
    assert.ok((await stateOf(target)).suspended_until);
    const log = (await call('/moderation/actions', { token: admin.token })).body.actions.find((a) => a.username === target.username && a.action === 'suspend');
    assert.equal(log.admin_username, mod.username, 'and the log says who');
  });

  await t.test('a moderator cannot act on another moderator or an admin; an admin can act on a moderator', async () => {
    const against = async (target) => {
      const reporter = await newPlayer();
      await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: target.username, reason: 'other' }) });
      return (await queueFor(admin)).reports.find((r) => r.reported_username === target.username);
    };
    const victimMod = await staff('is_moderator');
    const onMod = await against(victimMod);
    assert.equal((await queueFor(mod)).reports.find((r) => r.id === onMod.id).actionable, false);
    assert.equal((await queueFor(mod)).reports.find((r) => r.id === onMod.id).reported_role, 'moderator');
    assert.equal((await act(mod, onMod, { actions: ['warn'], note: NOTE })).body.error, 'cannot_moderate_staff');
    assert.equal((await queueFor(admin)).reports.find((r) => r.id === onMod.id).actionable, true);
    assert.equal((await act(admin, onMod, { actions: ['warn'], note: NOTE })).status, 200);

    const otherAdmin = await staff('is_admin');
    const onAdmin = await against(otherAdmin);
    assert.equal((await act(admin, onAdmin, { actions: ['warn'], note: NOTE })).body.error, 'cannot_moderate_admin');
    assert.equal((await act(mod, onAdmin, { actions: ['warn'], note: NOTE })).body.error, 'cannot_moderate_admin');
  });

  await t.test('a suggestion that would be a ban is cut down for a moderator, who is told to escalate', async () => {
    const target = await newPlayer();
    for (let i = 0; i < 3; i += 1) {
      const reporter = await newPlayer();
      await pool.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, status, reviewed_at, resolution) VALUES ($1, $2, 'harassment', 'actioned', now(), 'Warned')`,
        [reporter.id, target.id],
      );
    }
    await reportAgainst(target);
    const forAdmin = (await queueFor(admin)).reports.find((r) => r.reported_username === target.username);
    assert.deepEqual(forAdmin.suggestion.actions, ['ban']);
    assert.equal(forAdmin.suggestion.needs_admin, false);

    const forMod = (await queueFor(mod)).reports.find((r) => r.reported_username === target.username);
    assert.equal(forMod.suggestion.actions.includes('ban'), false);
    assert.equal(forMod.suggestion.needs_admin, true);
    assert.deepEqual(forMod.suggestion.actions, ['suspend']);
    assert.equal(forMod.suggestion.days, 7);
  });

  await t.test('a moderator can escalate a report, and an admin sees it first', async () => {
    const target = await newPlayer();
    const report = await reportAgainst(target);
    const player = await newPlayer();
    assert.equal((await call(`/reports/${report.id}/escalate`, { method: 'POST', token: player.token, body: json({ note: 'x' }) })).status, 403);

    const esc = await call(`/reports/${report.id}/escalate`, { method: 'POST', token: mod.token, body: json({ note: 'This looks like a pattern; I think it needs a ban.' }) });
    assert.equal(esc.status, 204);
    assert.equal((await call(`/reports/${report.id}/escalate`, { method: 'POST', token: mod.token, body: json({}) })).status, 204, 'again is no harm');

    const queue = (await queueFor(admin)).reports;
    const mine = queue.find((r) => r.id === report.id);
    assert.equal(mine.escalated.by, mod.username);
    assert.match(mine.escalated.note, /pattern/);
    // Every escalated report comes before every one that is not (others may be waiting on a shared database).
    const firstPlain = queue.findIndex((r) => !r.escalated);
    assert.ok(queue.slice(firstPlain === -1 ? queue.length : firstPlain).every((r) => !r.escalated), 'escalated reports come first');
    assert.ok(queue.indexOf(mine) < (firstPlain === -1 ? queue.length : firstPlain) || firstPlain === -1);
    assert.equal((await call('/reports/999999999/escalate', { method: 'POST', token: mod.token, body: json({}) })).status, 404);
    assert.equal((await act(admin, report, { actions: ['ban'], note: NOTE })).status, 200, 'and the admin can finish it');
  });

  await t.test('a moderator can lift what they applied, and not what an admin did or any ban', async () => {
    const mine = await newPlayer();
    const theirs = await newPlayer();
    const banned = await newPlayer();
    await act(mod, await reportAgainst(mine), { actions: ['suspend'], days: 1, note: NOTE });
    await act(admin, await reportAgainst(theirs), { actions: ['suspend'], days: 7, note: NOTE });
    await act(admin, await reportAgainst(banned), { actions: ['ban'], note: NOTE });

    const log = async (as) => (await call('/moderation/actions', { token: as.token })).body.actions;
    const find = async (as, p, action) => (await log(as)).find((a) => a.username === p.username && a.action === action);
    const lift = (as, id) => call(`/moderation/actions/${id}/lift`, { method: 'POST', token: as.token });

    assert.equal((await find(mod, mine, 'suspend')).can_lift, true);
    assert.equal((await find(mod, theirs, 'suspend')).can_lift, false);
    assert.equal((await find(mod, banned, 'ban')).can_lift, false);
    assert.equal((await find(admin, banned, 'ban')).can_lift, true);

    assert.equal((await lift(mod2, (await find(mod, mine, 'suspend')).id)).status, 403, 'not another moderator’s');
    assert.equal((await lift(mod, (await find(mod, theirs, 'suspend')).id)).body.error, 'needs_admin');
    assert.equal((await lift(mod, (await find(mod, banned, 'ban')).id)).status, 403);
    assert.equal((await lift(mod, (await find(mod, mine, 'suspend')).id)).status, 204);
    assert.equal((await lift(admin, (await find(admin, theirs, 'suspend')).id)).status, 204);
  });

  await t.test('the admin-only screens stay closed to a moderator', async () => {
    assert.equal((await call('/suggestions/admin', { token: mod.token })).status, 403);
    assert.equal((await call('/admin/titles', { token: mod.token })).status, 403);
    assert.equal((await call('/admin/titles', { method: 'POST', token: mod.token, body: json({ username: 'x', title: 'prefect' }) })).status, 403);
    assert.equal((await call('/admin/team', { token: mod.token })).status, 403);
    assert.equal((await call('/admin/team', { method: 'POST', token: mod.token, body: json({ username: 'x', role: 'moderator' }) })).status, 403);
  });

  await t.test('an admin makes and unmakes a moderator, with the Prefect title if they want it', async () => {
    const player = await newPlayer();
    const set = (as, body) => call('/admin/team', { method: 'POST', token: as.token, body: json(body) });

    assert.equal((await set(admin, { username: player.username, role: 'wizard' })).body.error, 'invalid_role');
    assert.equal((await set(admin, { username: 'nobody-by-this-name', role: 'moderator' })).status, 404);
    assert.equal((await set(admin, { username: admin.username, role: 'moderator' })).body.error, 'cannot_change_admin');

    assert.equal((await set(admin, { username: player.username, role: 'moderator', give_title: true })).status, 200);
    const me = (await call('/auth/me', { token: player.token })).body.user;
    assert.equal(me.role, 'moderator');
    assert.equal((await call('/reports', { token: player.token })).status, 200, 'and the screens open');
    const offered = (await call('/account/customization', { token: player.token })).body.titles.find((x) => x.id === 'prefect');
    assert.equal(offered.held, true, 'with the title');

    const team = (await call('/admin/team', { token: admin.token })).body.team;
    assert.equal(team.find((x) => x.username === player.username).role, 'moderator');
    assert.ok(team.find((x) => x.username === admin.username && x.role === 'admin'));

    await call('/account/profile', { method: 'PATCH', token: player.token, body: json({ title: 'prefect' }) });
    assert.equal((await set(admin, { username: player.username, role: 'player' })).status, 200);
    assert.equal((await call('/reports', { token: player.token })).status, 403, 'the screens close');
    const after = (await call('/auth/me', { token: player.token })).body.user;
    assert.equal(after.role, 'player');
    assert.equal(after.title, null, 'and the title that said so goes with it');
  });

  await t.test('deleting the account takes the role with it', async () => {
    const leaving = await staff('is_moderator');
    await call('/account', { method: 'DELETE', token: leaving.token, body: json({ password: 'password123' }) });
    assert.equal((await pool.query('SELECT is_moderator FROM users WHERE id = $1', [leaving.id])).rows[0].is_moderator, false);
  });
});
