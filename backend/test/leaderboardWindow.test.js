import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLeaderboardWindow } from '../src/lib/leaderboardWindow.js';

test('two dates in the same ISO week produce the same key', () => {
  const monday = new Date('2026-09-14T08:00:00Z');
  const sunday = new Date('2026-09-20T20:00:00Z');
  assert.equal(currentLeaderboardWindow(monday), currentLeaderboardWindow(sunday));
});

test('consecutive weeks produce different keys', () => {
  const weekOne = new Date('2026-09-14T08:00:00Z');
  const weekTwo = new Date('2026-09-21T08:00:00Z');
  assert.notEqual(currentLeaderboardWindow(weekOne), currentLeaderboardWindow(weekTwo));
});

test('a date at the year boundary attributes to the correct ISO year', () => {
  // Jan 1 2027 is a Friday, so it belongs to the same ISO week as late Dec 2026.
  assert.equal(currentLeaderboardWindow(new Date('2027-01-01T00:00:00Z')), '2026-W53');
});

test('key format is YYYY-Www', () => {
  assert.match(currentLeaderboardWindow(new Date('2026-06-15T00:00:00Z')), /^\d{4}-W\d{2}$/);
});
