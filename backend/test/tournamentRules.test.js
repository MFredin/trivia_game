import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreate, joinCheck, startCheck, canTransition, deadlineFrom, lobbyExpired, overdue, NAME_MAX_LENGTH, OPEN_LOBBY_DAYS,
} from '../src/lib/tournamentRules.js';

test('a creator gets sensible defaults for what they leave out', () => {
  assert.deepEqual(validateCreate({ name: '  Friday   Night  ' }).value, {
    name: 'Friday Night', size: 8, roundHours: 48, canonSource: 'combined', category: null, difficulty: null,
  });
});

test('the name is required, short, and passes the same rules as a bio', () => {
  assert.equal(validateCreate({}).error, 'invalid_name');
  assert.equal(validateCreate({ name: '   ' }).error, 'invalid_name');
  assert.equal(validateCreate({ name: 'x'.repeat(NAME_MAX_LENGTH + 1) }).error, 'name_too_long');
  assert.equal(validateCreate({ name: 'x'.repeat(NAME_MAX_LENGTH) }).error, undefined);
  assert.equal(validateCreate({ name: 'join at example.com' }).error, 'invalid_name', 'a link in a name is refused');
  assert.equal(validateCreate({ name: 42 }).error, 'invalid_name');
});

test('size, round length, canon and difficulty come from fixed menus', () => {
  assert.equal(validateCreate({ name: 'a', size: 6 }).error, 'invalid_size');
  assert.equal(validateCreate({ name: 'a', size: 16 }).value.size, 16);
  assert.equal(validateCreate({ name: 'a', round_hours: 12 }).error, 'invalid_round_hours');
  assert.equal(validateCreate({ name: 'a', round_hours: 72 }).value.roundHours, 72);
  assert.equal(validateCreate({ name: 'a', canon_source: 'comics' }).error, 'invalid_canon_source');
  assert.equal(validateCreate({ name: 'a', difficulty: 'Expert' }).error, 'invalid_difficulty');
  assert.equal(validateCreate({ name: 'a', difficulty: 'N.E.W.T.' }).value.difficulty, 'N.E.W.T.');
  assert.equal(validateCreate({ name: 'a', category: 42 }).error, 'invalid_category');
});

test('joining needs an open tournament with room, and only once', () => {
  assert.deepEqual(joinCheck({ status: 'open', size: 8, playerCount: 7, alreadyIn: false }), { ok: true });
  assert.equal(joinCheck({ status: 'open', size: 8, playerCount: 8, alreadyIn: false }).reason, 'full');
  assert.equal(joinCheck({ status: 'open', size: 8, playerCount: 3, alreadyIn: true }).reason, 'already_joined');
  for (const status of ['running', 'completed', 'cancelled']) {
    assert.equal(joinCheck({ status, size: 8, playerCount: 3, alreadyIn: false }).reason, 'not_open');
  }
});

test('starting needs three players and an open tournament', () => {
  assert.equal(startCheck({ status: 'open', playerCount: 2 }).reason, 'too_few_players');
  assert.deepEqual(startCheck({ status: 'open', playerCount: 3 }), { ok: true });
  assert.deepEqual(startCheck({ status: 'open', playerCount: 16 }), { ok: true });
  assert.equal(startCheck({ status: 'running', playerCount: 8 }).reason, 'not_open');
});

test('status only moves forward', () => {
  assert.equal(canTransition('open', 'running'), true);
  assert.equal(canTransition('open', 'cancelled'), true);
  assert.equal(canTransition('running', 'completed'), true);
  assert.equal(canTransition('running', 'cancelled'), true);
  assert.equal(canTransition('completed', 'running'), false);
  assert.equal(canTransition('cancelled', 'open'), false);
  assert.equal(canTransition('open', 'completed'), false);
  assert.equal(canTransition('nonsense', 'open'), false);
});

test('a deadline is the round length after the round opens', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  assert.equal(deadlineFrom(now, 48).toISOString(), '2026-10-08T12:00:00.000Z');
  assert.equal(deadlineFrom(now, 24).toISOString(), '2026-10-07T12:00:00.000Z');
});

test('an open lobby expires after a week, not before', () => {
  const created = new Date('2026-10-01T00:00:00Z');
  assert.equal(lobbyExpired(created, new Date(created.getTime() + (OPEN_LOBBY_DAYS * 24 - 1) * 3600 * 1000)), false);
  assert.equal(lobbyExpired(created, new Date(created.getTime() + (OPEN_LOBBY_DAYS * 24 + 1) * 3600 * 1000)), true);
});

test('only an open match past its deadline is overdue', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const past = new Date('2026-10-06T11:59:59Z');
  const future = new Date('2026-10-06T12:00:01Z');
  assert.equal(overdue({ status: 'open', deadline: past }, now), true);
  assert.equal(overdue({ status: 'open', deadline: now }, now), true, 'the deadline itself counts as passed');
  assert.equal(overdue({ status: 'open', deadline: future }, now), false);
  assert.equal(overdue({ status: 'decided', deadline: past }, now), false);
  assert.equal(overdue({ status: 'waiting', deadline: null }, now), false);
});
