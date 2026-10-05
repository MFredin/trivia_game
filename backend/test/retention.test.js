import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, newPlayer, skip } from './helpers/app.js';
import { CLOSED_REPORT_DAYS, MODERATION_ACTION_DAYS, REPORT_EVIDENCE_DAYS } from '../src/lib/retention.js';
import { sweepModerationRecords } from '../src/services/retention.js';

test('how long moderation records are kept', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  assert.ok(REPORT_EVIDENCE_DAYS < CLOSED_REPORT_DAYS, 'copies of messages go before the report that carried them');
  assert.ok(CLOSED_REPORT_DAYS >= 180, 'the history a suggestion is worked out from (HISTORY_DAYS) is still there');

  const ago = (days) => `now() - interval '${days} days'`;
  const admin = await newPlayer();

  async function report({ status = 'actioned', closedDaysAgo, evidence = true }) {
    const reporter = await newPlayer();
    const target = await newPlayer();
    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_id, reported_id, reason, status, reviewed_at, evidence)
       VALUES ($1, $2, 'harassment', $3, ${closedDaysAgo == null ? 'NULL' : ago(closedDaysAgo)}, $4) RETURNING id`,
      [reporter.id, target.id, status, evidence ? JSON.stringify([{ sender_username: 'x', body: 'hello', created_at: new Date() }]) : null],
    );
    return { id: rows[0].id, target };
  }
  const row = async (id) => (await pool.query('SELECT id, evidence FROM reports WHERE id = $1', [id])).rows[0];
  async function action(target, { type = 'warn', createdDaysAgo, expiresDaysAgo, liftedDaysAgo, reportId = null }) {
    const { rows } = await pool.query(
      `INSERT INTO moderation_actions (batch_id, user_id, report_id, admin_id, action, note, days, expires_at, lifted_at, created_at, acknowledged_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'a note for the player', NULL, ${expiresDaysAgo == null ? 'NULL' : ago(expiresDaysAgo)},
               ${liftedDaysAgo == null ? 'NULL' : ago(liftedDaysAgo)}, ${ago(createdDaysAgo)}, now()) RETURNING id`,
      [target.id, reportId, admin.id, type],
    );
    return rows[0].id;
  }
  const gone = async (id) => (await pool.query('SELECT 1 FROM moderation_actions WHERE id = $1', [id])).rowCount === 0;

  await t.test('the copy of a conversation goes first, and the report stays', async () => {
    const old = await report({ closedDaysAgo: REPORT_EVIDENCE_DAYS + 5 });
    const recent = await report({ closedDaysAgo: 10 });
    const open = await report({ status: 'open', closedDaysAgo: null });
    await pool.query(`UPDATE reports SET created_at = ${ago(400)} WHERE id = $1`, [open.id]);

    await sweepModerationRecords();
    assert.equal((await row(old.id)).evidence, null, 'past the evidence period');
    assert.ok(await row(old.id), 'but the report itself is still there');
    assert.ok((await row(recent.id)).evidence, 'a recent one keeps it');
    assert.ok((await row(open.id)).evidence, 'and one that is still open keeps it however long it has waited');
  });

  await t.test('a closed report goes after a year; an open one never', async () => {
    const old = await report({ closedDaysAgo: CLOSED_REPORT_DAYS + 5 });
    const young = await report({ closedDaysAgo: CLOSED_REPORT_DAYS - 5, evidence: false });
    const open = await report({ status: 'open', closedDaysAgo: null, evidence: false });
    await sweepModerationRecords();
    assert.equal(await row(old.id), undefined);
    assert.ok(await row(young.id));
    assert.ok(await row(open.id));
  });

  await t.test('what was done to a player goes a year after it stopped mattering, and not while it is in force', async () => {
    const p = (await newPlayer());
    const old = MODERATION_ACTION_DAYS + 10;
    const oldWarning = await action(p, { type: 'warn', createdDaysAgo: old });
    const newWarning = await action(p, { type: 'warn', createdDaysAgo: 20 });
    const endedSuspension = await action(p, { type: 'suspend', createdDaysAgo: old + 7, expiresDaysAgo: old });
    const recentSuspension = await action(p, { type: 'suspend', createdDaysAgo: 30, expiresDaysAgo: 23 });
    const liftedBan = await action(p, { type: 'ban', createdDaysAgo: old + 30, liftedDaysAgo: old });
    const standingBan = await action(p, { type: 'ban', createdDaysAgo: old + 30 });
    const liftedRecently = await action(p, { type: 'ban', createdDaysAgo: old + 30, liftedDaysAgo: 5 });

    await sweepModerationRecords();
    assert.equal(await gone(oldWarning), true);
    assert.equal(await gone(endedSuspension), true);
    assert.equal(await gone(liftedBan), true);
    for (const id of [newWarning, recentSuspension, standingBan, liftedRecently]) assert.equal(await gone(id), false, `action ${id} stays`);
  });

  await t.test('a report that goes does not take with it a sanction that is still in force', async () => {
    const closed = await report({ closedDaysAgo: CLOSED_REPORT_DAYS + 5, evidence: false });
    const ban = await action(closed.target, { type: 'ban', createdDaysAgo: CLOSED_REPORT_DAYS + 5, reportId: closed.id });
    await sweepModerationRecords();
    assert.equal(await row(closed.id), undefined, 'the report is gone');
    assert.equal(await gone(ban), false, 'the ban stands');
    assert.equal((await pool.query('SELECT report_id FROM moderation_actions WHERE id = $1', [ban])).rows[0].report_id, null);
  });

  await t.test('sweeping again changes nothing', async () => {
    const first = await sweepModerationRecords();
    const second = await sweepModerationRecords();
    assert.deepEqual(second, { evidenceCleared: 0, reportsDeleted: 0, actionsDeleted: 0 });
    assert.ok(first);
  });
});
