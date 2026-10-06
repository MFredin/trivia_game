import test from 'node:test';
import assert from 'node:assert/strict';
import { MODERATION_ACTIONS, SUSPENSION_DAYS } from '../src/lib/moderation.js';
import { allowedActions, allowedDays, canActOn, canReviewReports, checkRoleLimits, clampSuggestion, roleOf } from '../src/lib/roles.js';

test('who is what', async (t) => {
  await t.test('a role follows from the two flags, admin first', () => {
    assert.equal(roleOf({ is_admin: false, is_moderator: false }), 'player');
    assert.equal(roleOf({ is_admin: false, is_moderator: true }), 'moderator');
    assert.equal(roleOf({ is_admin: true, is_moderator: false }), 'admin');
    assert.equal(roleOf({ is_admin: true, is_moderator: true }), 'admin');
    assert.equal(roleOf({}), 'player');
  });

  await t.test('only staff review reports', () => {
    assert.deepEqual(['player', 'moderator', 'admin'].map(canReviewReports), [false, true, true]);
  });
});

test('what each role may do about a report', async (t) => {
  await t.test('a moderator has everything but the ban; an admin has it all', () => {
    assert.deepEqual(allowedActions('admin'), MODERATION_ACTIONS);
    assert.equal(allowedActions('moderator').includes('ban'), false);
    assert.equal(allowedActions('moderator').includes('suspend'), true);
    assert.deepEqual(allowedActions('player'), []);
  });

  await t.test('a moderator’s timed actions stop at a week', () => {
    assert.deepEqual(allowedDays('admin'), SUSPENSION_DAYS);
    assert.deepEqual(allowedDays('moderator'), [1, 7]);
    assert.deepEqual(allowedDays('player'), []);
  });

  await t.test('who can be acted on: a moderator only players; an admin anyone but an admin', () => {
    assert.equal(canActOn('moderator', 'player'), true);
    assert.equal(canActOn('moderator', 'moderator'), false);
    assert.equal(canActOn('moderator', 'admin'), false);
    assert.equal(canActOn('admin', 'player'), true);
    assert.equal(canActOn('admin', 'moderator'), true);
    assert.equal(canActOn('admin', 'admin'), false);
    assert.equal(canActOn('player', 'player'), false);
  });

  await t.test('a set of actions is checked against the role, and says what it needs', () => {
    assert.equal(checkRoleLimits('admin', ['ban'], null), null);
    assert.equal(checkRoleLimits('moderator', ['warn', 'suspend'], 7), null);
    assert.equal(checkRoleLimits('moderator', ['ban'], null), 'needs_admin');
    assert.equal(checkRoleLimits('moderator', ['suspend'], 30), 'needs_admin');
    assert.equal(checkRoleLimits('moderator', ['mute'], 30), 'needs_admin');
    assert.equal(checkRoleLimits('player', ['warn'], null), 'needs_admin');
  });

  await t.test('a suggestion a moderator cannot apply is cut down, and says an admin is needed', () => {
    assert.deepEqual(clampSuggestion('admin', { actions: ['ban'], days: null }), { actions: ['ban'], days: null, needs_admin: false });
    assert.deepEqual(clampSuggestion('moderator', { actions: ['warn'], days: null }), { actions: ['warn'], days: null, needs_admin: false });
    assert.deepEqual(clampSuggestion('moderator', { actions: ['ban'], days: null }), { actions: ['suspend'], days: 7, needs_admin: true });
    assert.deepEqual(clampSuggestion('moderator', { actions: ['remove_scores', 'suspend'], days: 30 }), {
      actions: ['remove_scores', 'suspend'],
      days: 7,
      needs_admin: true,
    });
  });
});
