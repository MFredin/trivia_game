import test from 'node:test';
import assert from 'node:assert/strict';
import { MODERATION_ACTIONS, SUSPENSION_DAYS, actionsFor, checkActionSet, describeResolution, suggestNext } from '../src/lib/moderation.js';
import { REPORT_REASONS } from '../src/lib/reportReasons.js';
import { hashEmail } from '../src/lib/emailHash.js';

test('what a moderator is offered and advised', async (t) => {
  await t.test('every kind of report has a ladder that ends in a ban', () => {
    for (const reason of REPORT_REASONS) {
      const last = suggestNext(reason, { priorActioned: 99 });
      assert.deepEqual(last.actions, ['ban'], reason);
    }
  });

  await t.test('a first offence is warned about or fixed, not suspended', () => {
    assert.deepEqual(suggestNext('offensive_name').actions, ['warn']);
    assert.deepEqual(suggestNext('offensive_bio').actions, ['clear_bio', 'warn']);
    assert.deepEqual(suggestNext('cheating').actions, ['remove_scores', 'warn']);
    assert.deepEqual(suggestNext('impersonation').actions, ['force_rename', 'warn']);
  });

  await t.test('a repeat escalates, and suspensions lengthen with each one', () => {
    // Harassment is the offence messaging makes possible, so the step after a warning is a mute:
    // the player keeps playing but cannot write to anyone.
    assert.deepEqual(suggestNext('harassment', { priorActioned: 1 }), { actions: ['mute'], days: 7 });
    assert.deepEqual(suggestNext('harassment', { priorActioned: 2, priorSuspensions: 0 }), { actions: ['suspend'], days: 1 });
    assert.deepEqual(suggestNext('harassment', { priorActioned: 2, priorSuspensions: 1 }), { actions: ['suspend'], days: 7 });
    assert.equal(suggestNext('harassment', { priorActioned: 2, priorSuspensions: 5 }).days, 30);
    assert.equal(suggestNext('harassment').days, null, 'no length unless suspending or muting');
  });

  await t.test('the actions offered put the relevant ones first and leave nothing out of reach', () => {
    const offered = actionsFor('offensive_bio');
    assert.equal(offered[0], 'clear_bio');
    assert.deepEqual([...offered].sort(), [...MODERATION_ACTIONS].sort());
    assert.deepEqual([...actionsFor('not-a-reason')].sort(), [...MODERATION_ACTIONS].sort());
  });

  await t.test('refuses sets of actions that make no sense together', () => {
    assert.equal(checkActionSet([], null), 'no_actions');
    assert.equal(checkActionSet('warn', null), 'no_actions');
    assert.equal(checkActionSet(['explode'], null), 'invalid_action');
    assert.equal(checkActionSet(['warn', 'warn'], null), 'invalid_action');
    assert.equal(checkActionSet(['ban', 'suspend'], 7), 'ban_and_suspend');
    assert.equal(checkActionSet(['suspend'], 3), 'invalid_days');
    assert.equal(checkActionSet(['suspend'], undefined), 'invalid_days');
    assert.equal(checkActionSet(['mute'], 5), 'invalid_days', 'a mute is timed like a suspension');
    assert.equal(checkActionSet(['mute', 'warn'], 7), null);
    assert.equal(checkActionSet(['warn', 'clear_bio'], null), null);
    for (const days of SUSPENSION_DAYS) assert.equal(checkActionSet(['suspend', 'warn'], days), null);
  });

  await t.test('describes what happened in words', () => {
    assert.equal(describeResolution(['warn'], null), 'Warned');
    assert.equal(describeResolution(['clear_bio', 'warn'], null), 'Bio cleared; warned');
    assert.equal(describeResolution(['suspend'], 1), 'Suspended 1 day');
    assert.equal(describeResolution(['mute', 'warn'], 7), 'Muted 7 days; warned');
    assert.equal(describeResolution(['remove_scores', 'suspend'], 7), 'Scores removed; suspended 7 days');
  });

  await t.test('the interface can name every action the server knows', async () => {
    // An action the server offers and the interface cannot label would be a blank checkbox.
    const frontend = await import('../../frontend/src/constants/moderationActions.js');
    assert.deepEqual(Object.keys(frontend.MODERATION_ACTION_BY_ID).sort(), [...MODERATION_ACTIONS].sort());
  });

  await t.test('an email hashes the same however it is written', () => {
    assert.equal(hashEmail('Someone@Example.COM '), hashEmail('someone@example.com'));
    assert.notEqual(hashEmail('a@example.com'), hashEmail('b@example.com'));
    assert.match(hashEmail('a@example.com'), /^[0-9a-f]{64}$/);
  });
});
